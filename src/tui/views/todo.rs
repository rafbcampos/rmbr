use std::collections::HashMap;

use chrono::{Duration, Utc};
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, ListItem, Paragraph};
use ratatui::Frame;

use crate::db::repository::CrudRepository;
use crate::db::todo::{
    duration_from_entries, CreateTodo, TodoFilter, TodoRepository, UpdateTodo,
};
use crate::db::tag::{EntityType, TagRepository};
use crate::db::Database;
use crate::models::todo::{Priority, TimeAction, Todo, TodoStatus};
use crate::tui::widgets::form::{Form, FormAction, FormField};
use crate::tui::widgets::list::SelectableList;
use crate::tui::widgets::picker::{Picker, PickerAction, PickerItem};
use crate::tui::{View, ViewAction, ViewMode};

pub struct TodoView {
    list: SelectableList<Todo>,
    durations: HashMap<i64, Duration>,
    mode: ViewMode,
    form: Option<Form>,
    picker: Option<Picker>,
    edit_id: Option<i64>,
    status_msg: Option<String>,
    loaded: bool,
    show_deleted: bool,
}

impl TodoView {
    pub fn new() -> Self {
        Self {
            list: SelectableList::new("Todos"),
            durations: HashMap::new(),
            mode: ViewMode::List,
            form: None,
            picker: None,
            edit_id: None,
            status_msg: None,
            loaded: false,
            show_deleted: false,
        }
    }

    /// Creates a view that opens directly into Edit mode for the given item.
    pub fn editing(db: &Database, id: i64) -> Self {
        let mut view = Self::new();
        view.reload(db);
        view.loaded = true;
        view.open_edit_by_id(id);
        view
    }

    /// Switches to Edit mode for the item with the given `id`, if present in the list.
    fn open_edit_by_id(&mut self, id: i64) {
        if let Some(todo) = self.list.items().iter().find(|t| t.id == id) {
            self.edit_id = Some(todo.id);
            self.form = Some(Self::build_edit_form(todo));
            self.mode = ViewMode::Edit;
        } else {
            self.status_msg = Some(format!("Todo #{id} not found."));
        }
    }

    fn reload(&mut self, db: &Database) {
        let todos = TodoRepository::list(db, TodoFilter {
            include_deleted: self.show_deleted,
            ..Default::default()
        }).unwrap_or_default();
        self.durations.clear();
        for todo in &todos {
            if matches!(todo.status, TodoStatus::InProgress | TodoStatus::Paused | TodoStatus::Done)
                && let Ok(entries) = TodoRepository::get_time_entries(db, todo.id)
                    && !entries.is_empty() {
                        self.durations.insert(todo.id, duration_from_entries(&entries, Utc::now()));
                    }
        }
        self.list.set_items(todos);
    }

    fn do_transition(
        &mut self,
        db: &Database,
        id: i64,
        action: TimeAction,
    ) {
        match TodoRepository::transition(db, id, action) {
            Ok((_todo, _entry)) => {
                self.status_msg = Some(format!("Todo #{id} → {}", action.target_status()));
                self.reload(db);
            }
            Err(e) => {
                self.status_msg = Some(format!("Error: {e}"));
            }
        }
    }

    fn build_add_form() -> Form {
        Form::new(
            "Add Todo",
            vec![
                FormField::text("Title", "", true, ""),
                FormField::text("Description", "", false, ""),
                FormField::select(
                    "Priority",
                    vec![
                        "low".to_string(),
                        "medium".to_string(),
                        "high".to_string(),
                        "urgent".to_string(),
                    ],
                    "medium",
                ),
                FormField::text("Due date", "", false, "YYYY-MM-DD"),
                FormField::text("Tags", "", false, "tag1, tag2"),
            ],
        )
    }

    fn build_edit_form(todo: &Todo) -> Form {
        Form::new(
            "Edit Todo",
            vec![
                FormField::text("Title", &todo.title, true, ""),
                FormField::text(
                    "Description",
                    todo.description.as_deref().unwrap_or(""),
                    false,
                    "",
                ),
                FormField::select(
                    "Priority",
                    vec![
                        "low".to_string(),
                        "medium".to_string(),
                        "high".to_string(),
                        "urgent".to_string(),
                    ],
                    &todo.priority.to_string(),
                ),
                FormField::text(
                    "Due date",
                    &todo.due_date.map_or(String::new(), |d| d.to_string()),
                    false,
                    "YYYY-MM-DD",
                ),
                FormField::text("Tags", &todo.tags.join(", "), false, "tag1, tag2"),
            ],
        )
    }

    fn submit_add(&mut self, db: &Database) {
        let form = match self.form.as_mut() {
            Some(f) => f,
            None => return,
        };
        form.clear_errors();

        let title = match form.require_non_empty("Title") {
            Some(t) => t,
            None => return,
        };

        let priority = form.value("Priority").parse::<Priority>().unwrap_or(Priority::Medium);
        let due_date = crate::cli::parse_date_opt(
            &form.value_opt("Due date").map(|s| s.to_string()),
        );
        let due_date = match due_date {
            Ok(d) => d,
            Err(e) => {
                form.set_field_error("Due date", format!("{e}"));
                return;
            }
        };

        let description = form.value_opt("Description").map(|s| s.to_string());

        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));

        match TodoRepository::create(
            db,
            CreateTodo { title: title.clone(), description, priority, due_date },
        ) {
            Ok(todo) => {
                if !tag_names.is_empty() {
                    let _ = TagRepository::set_tags_by_name(db, EntityType::Todo, todo.id, &tag_names);
                }
                self.status_msg = Some(format!("Todo #{} '{}' created.", todo.id, title));
                self.mode = ViewMode::List;
                self.form = None;
                self.reload(db);
            }
            Err(e) => {
                self.status_msg = Some(format!("Error: {e}"));
            }
        }
    }

    fn submit_edit(&mut self, db: &Database) {
        let edit_id = match self.edit_id {
            Some(id) => id,
            None => return,
        };
        let form = match self.form.as_mut() {
            Some(f) => f,
            None => return,
        };
        form.clear_errors();

        let title = match form.require_non_empty("Title") {
            Some(t) => t,
            None => return,
        };

        let priority = form.value("Priority").parse::<Priority>().unwrap_or(Priority::Medium);
        let due_date = match crate::cli::parse_date_opt(&form.value_opt("Due date").map(|s| s.to_string())) {
            Ok(d) => d,
            Err(e) => {
                form.set_field_error("Due date", format!("{e}"));
                return;
            }
        };

        let description = form.value_opt("Description").map(|s| s.to_string());
        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));

        match TodoRepository::update(
            db,
            edit_id,
            UpdateTodo {
                title: Some(title),
                description: Some(description),
                status: None,
                priority: Some(priority),
                due_date: Some(due_date),
            },
        ) {
            Ok(_) => {
                let _ = TagRepository::set_tags_by_name(db, EntityType::Todo, edit_id, &tag_names);
                self.status_msg = Some(format!("Todo #{edit_id} updated."));
                self.mode = ViewMode::List;
                self.form = None;
                self.edit_id = None;
                self.reload(db);
            }
            Err(e) => {
                self.status_msg = Some(format!("Error: {e}"));
            }
        }
    }
}

impl View for TodoView {
    fn draw(&mut self, frame: &mut Frame, area: Rect, db: &Database) {
        if !self.loaded {
            self.reload(db);
            self.loaded = true;
        }

        match self.mode {
            ViewMode::List => {
                // Refresh durations for in-progress todos (live timer on tick).
                for todo in self.list.items() {
                    if todo.status == TodoStatus::InProgress
                        && let Ok(entries) = TodoRepository::get_time_entries(db, todo.id)
                            && !entries.is_empty() {
                                self.durations.insert(todo.id, duration_from_entries(&entries, Utc::now()));
                            }
                }
                draw_list(frame, area, &mut self.list, &self.durations, &self.status_msg);
            }
            ViewMode::Detail => {
                if let Some(todo) = self.list.selected() {
                    draw_detail(frame, area, todo, db);
                }
            }
            ViewMode::Add | ViewMode::Edit => {
                if let Some(ref form) = self.form {
                    form.draw(frame, area);
                }
            }
            ViewMode::LinkPicker => {
                // Draw the detail view underneath, then overlay the picker.
                if let Some(todo) = self.list.selected() {
                    draw_detail(frame, area, todo, db);
                }
                if let Some(ref mut picker) = self.picker {
                    picker.draw(frame, area);
                }
            }
        }
    }

    fn handle_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction {
        match self.mode {
            ViewMode::List => self.handle_list_key(key, db),
            ViewMode::Detail => self.handle_detail_key(key, db),
            ViewMode::Add => self.handle_form_key(key, db, true),
            ViewMode::Edit => self.handle_form_key(key, db, false),
            ViewMode::LinkPicker => self.handle_picker_key(key, db),
        }
    }
}

impl TodoView {
    fn handle_list_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction {
        if self.list.is_searching() {
            use crate::tui::widgets::list::SearchAction;
            if let SearchAction::ExitWithSelection = self.list.handle_search_key(key, |t| format!("{} {}", t.title, t.tags.join(" "))) {
                if let Some(id) = self.list.selected().map(|t| t.id) {
                    self.open_edit_by_id(id);
                }
            }
            return ViewAction::Nothing;
        }

        // Let the list widget handle navigation first.
        if self.list.handle_key(key) {
            self.status_msg = None;
            return ViewAction::Nothing;
        }

        match key.code {
            KeyCode::Char('/') => {
                self.list.start_search();
                ViewAction::Nothing
            }
            KeyCode::Esc | KeyCode::Char('q') => ViewAction::Pop,
            KeyCode::Enter => {
                if self.list.selected().is_some() {
                    self.mode = ViewMode::Detail;
                }
                ViewAction::Nothing
            }
            KeyCode::Char('a') => {
                self.form = Some(Self::build_add_form());
                self.mode = ViewMode::Add;
                ViewAction::Nothing
            }
            KeyCode::Char('e') => {
                if let Some(id) = self.list.selected().map(|t| t.id) {
                    self.open_edit_by_id(id);
                }
                ViewAction::Nothing
            }
            KeyCode::Char('s') => {
                if let Some(todo) = self.list.selected() {
                    let id = todo.id;
                    self.do_transition(db, id, TimeAction::Start);
                }
                ViewAction::Nothing
            }
            KeyCode::Char('p') => {
                if let Some(todo) = self.list.selected() {
                    let id = todo.id;
                    self.do_transition(db, id, TimeAction::Pause);
                }
                ViewAction::Nothing
            }
            KeyCode::Char('r') => {
                if let Some(todo) = self.list.selected() {
                    let id = todo.id;
                    self.do_transition(db, id, TimeAction::Resume);
                }
                ViewAction::Nothing
            }
            KeyCode::Char('D') => {
                if let Some(todo) = self.list.selected() {
                    let id = todo.id;
                    self.do_transition(db, id, TimeAction::Done);
                }
                ViewAction::Nothing
            }
            KeyCode::Char('x') => {
                if let Some(todo) = self.list.selected() {
                    let id = todo.id;
                    self.do_transition(db, id, TimeAction::Cancel);
                }
                ViewAction::Nothing
            }
            KeyCode::Delete => {
                if let Some(todo) = self.list.selected() {
                    let id = todo.id;
                    match TodoRepository::soft_delete(db, id) {
                        Ok(()) => {
                            self.status_msg = Some(format!("Todo #{id} deleted."));
                            self.reload(db);
                        }
                        Err(e) => self.status_msg = Some(format!("Error: {e}")),
                    }
                }
                ViewAction::Nothing
            }
            KeyCode::Char('d') => {
                self.show_deleted = !self.show_deleted;
                self.status_msg = Some(if self.show_deleted {
                    "Showing deleted items.".to_string()
                } else {
                    "Hiding deleted items.".to_string()
                });
                self.reload(db);
                ViewAction::Nothing
            }
            KeyCode::Char('R') => {
                if let Some(todo) = self.list.selected() {
                    let id = todo.id;
                    match TodoRepository::restore(db, id) {
                        Ok(()) => {
                            self.status_msg = Some(format!("Todo #{id} restored."));
                            self.reload(db);
                        }
                        Err(e) => self.status_msg = Some(format!("Error: {e}")),
                    }
                }
                ViewAction::Nothing
            }
            _ => ViewAction::Nothing,
        }
    }

    fn handle_detail_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction {
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => {
                self.mode = ViewMode::List;
                ViewAction::Nothing
            }
            KeyCode::Char('L') => {
                // Open goal picker to link this todo to a goal.
                use crate::db::goal::{GoalFilter, GoalRepository};
                let goals = GoalRepository::list(db, GoalFilter::default()).unwrap_or_default();
                let items: Vec<PickerItem> = goals
                    .iter()
                    .map(|g| PickerItem { id: g.id, label: g.title.clone() })
                    .collect();
                self.picker = Some(Picker::new("Link to Goal", items));
                self.mode = ViewMode::LinkPicker;
                ViewAction::Nothing
            }
            _ => ViewAction::Nothing,
        }
    }

    fn handle_picker_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction {
        if let Some(ref mut picker) = self.picker {
            match picker.handle_key(key) {
                PickerAction::Selected(goal_id) => {
                    if let Some(todo) = self.list.selected() {
                        use crate::db::goal::GoalRepository;
                        let todo_id = todo.id;
                        match GoalRepository::link_todo(db, goal_id, todo_id) {
                            Ok(()) => self.status_msg = Some(format!("Linked to Goal #{goal_id}.")),
                            Err(e) => self.status_msg = Some(format!("Error: {e}")),
                        }
                    }
                    self.picker = None;
                    self.mode = ViewMode::Detail;
                }
                PickerAction::Cancelled => {
                    self.picker = None;
                    self.mode = ViewMode::Detail;
                }
                PickerAction::Browsing => {}
            }
        }
        ViewAction::Nothing
    }

    fn handle_form_key(&mut self, key: KeyEvent, db: &Database, is_add: bool) -> ViewAction {
        if let Some(ref mut form) = self.form {
            match form.handle_key(key) {
                FormAction::Editing => {}
                FormAction::Submit => {
                    if is_add {
                        self.submit_add(db);
                    } else {
                        self.submit_edit(db);
                    }
                }
                FormAction::Cancel => {
                    self.mode = ViewMode::List;
                    self.form = None;
                    self.edit_id = None;
                }
            }
        }
        ViewAction::Nothing
    }
}

// --- Drawing helpers --------------------------------------------------------

fn draw_list(
    frame: &mut Frame,
    area: Rect,
    list: &mut SelectableList<Todo>,
    durations: &HashMap<i64, Duration>,
    status_msg: &Option<String>,
) {
    let vertical = Layout::vertical([
        Constraint::Min(0),
        Constraint::Length(1), // status bar
        Constraint::Length(1), // keybindings
    ])
    .split(area);

    list.draw_or_empty(frame, vertical[0], "No todos. Press 'a' to add.", |todo, selected| {
        render_todo_item(todo, selected, durations.get(&todo.id))
    });

    // Status message.
    if let Some(msg) = status_msg {
        let status = Paragraph::new(Line::from(Span::styled(
            format!(" {msg}"),
            Style::default().fg(Color::Yellow),
        )));
        frame.render_widget(status, vertical[1]);
    }

    // Keybindings footer.
    let keys = Paragraph::new(Line::from(vec![
        Span::styled(" a", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::raw(":add "),
        Span::styled("e", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::raw(":edit "),
        Span::styled("s", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        Span::raw(":start "),
        Span::styled("p", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        Span::raw(":pause "),
        Span::styled("r", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        Span::raw(":resume "),
        Span::styled("D", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        Span::raw(":done "),
        Span::styled("x", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
        Span::raw(":cancel "),
        Span::styled("Del", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
        Span::raw(":delete "),
        Span::styled("q", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
        Span::raw(":back"),
    ]));
    frame.render_widget(keys, vertical[2]);
}

fn render_todo_item(todo: &Todo, _selected: bool, duration: Option<&Duration>) -> ListItem<'static> {
    let status_color = match todo.status {
        TodoStatus::Pending => Color::Gray,
        TodoStatus::InProgress => Color::Green,
        TodoStatus::Paused => Color::Yellow,
        TodoStatus::Done => Color::DarkGray,
        TodoStatus::Cancelled => Color::Red,
    };

    let priority_color = match todo.priority {
        Priority::Low => Color::DarkGray,
        Priority::Medium => Color::White,
        Priority::High => Color::Yellow,
        Priority::Urgent => Color::Red,
    };

    let due = todo
        .due_date
        .map_or(String::new(), |d| format!(" due:{d}"));
    let tags = crate::cli::format_tags(&todo.tags);
    let time_display = duration.map_or(String::new(), |d| {
        let h = d.num_hours();
        let m = d.num_minutes() % 60;
        format!(" {h}h{m:02}m")
    });

    let line = Line::from(vec![
        Span::styled(
            format!(" #{:<4}", todo.id),
            Style::default().fg(Color::DarkGray),
        ),
        Span::styled(
            format!("{:12}", todo.status.to_string()),
            Style::default().fg(status_color),
        ),
        Span::styled(
            format!("{:8}", todo.priority.to_string()),
            Style::default().fg(priority_color),
        ),
        Span::raw(todo.title.clone()),
        Span::styled(time_display, Style::default().fg(Color::Cyan).add_modifier(Modifier::DIM)),
        Span::styled(due, Style::default().fg(Color::DarkGray)),
        Span::styled(tags, Style::default().fg(Color::Cyan)),
    ]);

    ListItem::new(line)
}

fn draw_detail(frame: &mut Frame, area: Rect, todo: &Todo, db: &Database) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(format!(" Todo #{} ", todo.id));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let mut lines = vec![
        Line::from(vec![
            Span::styled("  Title: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(&todo.title),
        ]),
        Line::from(vec![
            Span::styled("  Status: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(todo.status.to_string()),
        ]),
        Line::from(vec![
            Span::styled("  Priority: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(todo.priority.to_string()),
        ]),
    ];

    if let Some(ref desc) = todo.description {
        lines.push(Line::from(vec![
            Span::styled("  Description: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(desc),
        ]));
    }
    if let Some(due) = todo.due_date {
        lines.push(Line::from(vec![
            Span::styled("  Due: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(due.to_string()),
        ]));
    }
    if !todo.tags.is_empty() {
        lines.push(Line::from(vec![
            Span::styled("  Tags: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(todo.tags.join(", ")),
        ]));
    }

    // Time entries.
    if let Ok(entries) = TodoRepository::get_time_entries(db, todo.id)
        && !entries.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "  Time Entries:",
                Style::default().add_modifier(Modifier::BOLD),
            )));
            for entry in &entries {
                lines.push(Line::from(format!(
                    "    {} at {}",
                    entry.action,
                    entry.timestamp.format("%Y-%m-%d %H:%M")
                )));
            }
            let duration = duration_from_entries(&entries, Utc::now());
            let hours = duration.num_hours();
            let mins = duration.num_minutes() % 60;
            lines.push(Line::from(format!("    Total: {hours}h {mins}m")));
        }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "  Press Esc to go back",
        Style::default().fg(Color::DarkGray),
    )));

    let paragraph = Paragraph::new(lines);
    frame.render_widget(paragraph, inner);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::todo::{CreateTodo, TodoRepository};
    use crate::tui::testutil::{key, test_db};

    fn seeded_db() -> Database {
        let db = test_db();
        TodoRepository::create(
            &db,
            CreateTodo {
                title: "First".to_string(),
                description: None,
                priority: Priority::High,
                due_date: None,
            },
        )
        .unwrap();
        TodoRepository::create(
            &db,
            CreateTodo {
                title: "Second".to_string(),
                description: None,
                priority: Priority::Medium,
                due_date: None,
            },
        )
        .unwrap();
        db
    }

    #[test]
    fn q_pops_view() {
        let db = test_db();
        let mut view = TodoView::new();
        assert!(matches!(view.handle_key(key(KeyCode::Char('q')), &db), ViewAction::Pop));
    }

    #[test]
    fn esc_pops_view() {
        let db = test_db();
        let mut view = TodoView::new();
        assert!(matches!(view.handle_key(key(KeyCode::Esc), &db), ViewAction::Pop));
    }

    #[test]
    fn loads_data_on_first_draw() {
        let db = seeded_db();
        let mut view = TodoView::new();
        assert!(view.list.items().is_empty());

        let backend = ratatui::backend::TestBackend::new(100, 20);
        let mut terminal = ratatui::Terminal::new(backend).unwrap();
        terminal.draw(|frame| view.draw(frame, frame.area(), &db)).unwrap();
        assert_eq!(view.list.items().len(), 2);
    }

    #[test]
    fn enter_switches_to_detail() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);
        view.handle_key(key(KeyCode::Enter), &db);
        assert!(matches!(view.mode, ViewMode::Detail));
    }

    #[test]
    fn esc_from_detail_returns_to_list() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);
        view.handle_key(key(KeyCode::Enter), &db); // detail mode
        view.handle_key(key(KeyCode::Esc), &db);
        assert!(matches!(view.mode, ViewMode::List));
    }

    #[test]
    fn a_opens_add_form() {
        let db = test_db();
        let mut view = TodoView::new();
        view.handle_key(key(KeyCode::Char('a')), &db);
        assert!(matches!(view.mode, ViewMode::Add));
        assert!(view.form.is_some());
    }

    #[test]
    fn e_opens_edit_form() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);
        view.handle_key(key(KeyCode::Char('e')), &db);
        assert!(matches!(view.mode, ViewMode::Edit));
        assert!(view.edit_id.is_some());
    }

    #[test]
    fn start_transition() {
        let db = seeded_db();
        let mut view = TodoView::new();
        // Down loads data (selection starts at 0) then moves to 1.
        // We want to start the item at index 0, so just trigger any key to load
        // then use 's' on the first selected item.
        view.reload(&db);
        // Selection is at 0 = "Second" (most recent, created_at DESC).
        view.handle_key(key(KeyCode::Char('s')), &db); // start selected

        // The started todo should now be in-progress.
        assert!(view.status_msg.as_ref().unwrap().contains("in-progress"));
        // Verify that at least one todo in the list is in-progress.
        let has_in_progress = view.list.items().iter().any(|t| t.status == TodoStatus::InProgress);
        assert!(has_in_progress, "one todo should be in-progress after start");
    }

    #[test]
    fn invalid_transition_shows_error() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);
        // Try to pause a pending todo — invalid transition.
        view.handle_key(key(KeyCode::Char('p')), &db);
        assert!(view.status_msg.as_ref().unwrap().contains("Error"));
    }

    #[test]
    fn delete_key_soft_deletes() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);
        view.handle_key(key(KeyCode::Delete), &db);

        // Should have 1 todo left (deleted one is filtered out).
        assert_eq!(view.list.items().len(), 1);
        assert!(view.status_msg.as_ref().unwrap().contains("deleted"));
    }

    #[test]
    fn render_list_mode() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);

        let backend = ratatui::backend::TestBackend::new(100, 20);
        let mut terminal = ratatui::Terminal::new(backend).unwrap();
        terminal
            .draw(|frame| view.draw(frame, frame.area(), &db))
            .unwrap();

        let buffer = terminal.backend().buffer().clone();
        let mut output = String::new();
        for y in 0..buffer.area.height {
            for x in 0..buffer.area.width {
                output.push_str(buffer[(x, y)].symbol());
            }
        }

        assert!(output.contains("First"), "should render first todo");
        assert!(output.contains("Second"), "should render second todo");
    }

    #[test]
    fn search_enter_opens_edit() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);

        // Start search, type 'F' to filter to "First".
        view.handle_key(key(KeyCode::Char('/')), &db);
        assert!(view.list.is_searching());

        view.handle_key(key(KeyCode::Char('F')), &db);
        view.handle_key(key(KeyCode::Char('i')), &db);
        view.handle_key(key(KeyCode::Char('r')), &db);

        // Press Enter to confirm search selection.
        view.handle_key(key(KeyCode::Enter), &db);

        assert!(matches!(view.mode, ViewMode::Edit), "search enter should open edit mode");
        assert!(view.form.is_some(), "edit form should be present");
        assert!(view.edit_id.is_some(), "edit_id should be set");
    }

    // --- Form validation tests ------------------------------------------------

    #[test]
    fn submit_add_empty_title_shows_field_error() {
        let db = test_db();
        let mut view = TodoView::new();
        // Open add form.
        view.handle_key(key(KeyCode::Char('a')), &db);
        assert!(matches!(view.mode, ViewMode::Add));

        // Navigate to Tags (last field, index 4) without typing anything.
        // Fields: Title(0) -> Description(1) -> Priority(2) -> Due date(3) -> Tags(4)
        view.handle_key(key(KeyCode::Tab), &db); // -> Description
        view.handle_key(key(KeyCode::Tab), &db); // -> Priority
        view.handle_key(key(KeyCode::Tab), &db); // -> Due date
        view.handle_key(key(KeyCode::Tab), &db); // -> Tags

        // Submit from last field.
        view.handle_key(key(KeyCode::Enter), &db);

        // Should still be in Add mode with a field error on Title.
        assert!(matches!(view.mode, ViewMode::Add));
        let title_error = view
            .form
            .as_ref()
            .unwrap()
            .fields
            .iter()
            .find(|f| f.label == "Title")
            .unwrap()
            .error
            .as_deref();
        assert_eq!(title_error, Some("Title is required."));
    }

    #[test]
    fn submit_add_invalid_date_shows_field_error() {
        let db = test_db();
        let mut view = TodoView::new();
        view.handle_key(key(KeyCode::Char('a')), &db);

        // Type a title.
        view.handle_key(key(KeyCode::Char('T')), &db);
        view.handle_key(key(KeyCode::Char('e')), &db);
        view.handle_key(key(KeyCode::Char('s')), &db);
        view.handle_key(key(KeyCode::Char('t')), &db);

        // Tab to Due date (index 3).
        view.handle_key(key(KeyCode::Tab), &db); // -> Description
        view.handle_key(key(KeyCode::Tab), &db); // -> Priority
        view.handle_key(key(KeyCode::Tab), &db); // -> Due date

        // Type an invalid date.
        for c in "baddate".chars() {
            view.handle_key(key(KeyCode::Char(c)), &db);
        }

        // Tab to Tags, then submit.
        view.handle_key(key(KeyCode::Tab), &db); // -> Tags
        view.handle_key(key(KeyCode::Enter), &db);

        // Should still be in Add mode.
        assert!(matches!(view.mode, ViewMode::Add));
        let due_error = view
            .form
            .as_ref()
            .unwrap()
            .fields
            .iter()
            .find(|f| f.label == "Due date")
            .unwrap()
            .error
            .as_deref()
            .expect("Due date field should have an error");
        assert!(
            due_error.contains("invalid date"),
            "error should mention 'invalid date', got: {due_error}"
        );
    }

    #[test]
    fn submit_add_compact_date_works() {
        let db = test_db();
        let mut view = TodoView::new();
        view.handle_key(key(KeyCode::Char('a')), &db);

        // Type title "CompactDate".
        for c in "CompactDate".chars() {
            view.handle_key(key(KeyCode::Char(c)), &db);
        }

        // Tab past Description, Priority to Due date.
        view.handle_key(key(KeyCode::Tab), &db); // -> Description
        view.handle_key(key(KeyCode::Tab), &db); // -> Priority
        view.handle_key(key(KeyCode::Tab), &db); // -> Due date

        // Type compact date.
        for c in "20260408".chars() {
            view.handle_key(key(KeyCode::Char(c)), &db);
        }

        // Tab to Tags (last field), then submit.
        view.handle_key(key(KeyCode::Tab), &db); // -> Tags
        view.handle_key(key(KeyCode::Enter), &db);

        // Should succeed — back to list.
        assert!(matches!(view.mode, ViewMode::List), "mode should be List after successful add");
        assert_eq!(view.list.items().len(), 1, "list should have 1 todo");
        assert_eq!(view.list.items()[0].title, "CompactDate");
    }

    #[test]
    fn submit_add_success_reloads_list() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);
        assert_eq!(view.list.items().len(), 2);

        // Open add form.
        view.handle_key(key(KeyCode::Char('a')), &db);

        // Type title "Third".
        for c in "Third".chars() {
            view.handle_key(key(KeyCode::Char(c)), &db);
        }

        // Navigate to last field and submit.
        view.handle_key(key(KeyCode::Tab), &db); // -> Description
        view.handle_key(key(KeyCode::Tab), &db); // -> Priority
        view.handle_key(key(KeyCode::Tab), &db); // -> Due date
        view.handle_key(key(KeyCode::Tab), &db); // -> Tags
        view.handle_key(key(KeyCode::Enter), &db);

        assert!(matches!(view.mode, ViewMode::List));
        assert_eq!(view.list.items().len(), 3, "list should have 3 items after add");
        assert!(
            view.status_msg.as_ref().unwrap().contains("created"),
            "status should mention 'created', got: {:?}",
            view.status_msg
        );
    }

    #[test]
    fn submit_edit_invalid_date_shows_field_error() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);

        // Open edit form on the selected item.
        view.handle_key(key(KeyCode::Char('e')), &db);
        assert!(matches!(view.mode, ViewMode::Edit));

        // Navigate to Due date field (index 3).
        view.handle_key(key(KeyCode::Tab), &db); // -> Description
        view.handle_key(key(KeyCode::Tab), &db); // -> Priority
        view.handle_key(key(KeyCode::Tab), &db); // -> Due date

        // Type an invalid date.
        for c in "notadate".chars() {
            view.handle_key(key(KeyCode::Char(c)), &db);
        }

        // Navigate to Tags and submit.
        view.handle_key(key(KeyCode::Tab), &db); // -> Tags
        view.handle_key(key(KeyCode::Enter), &db);

        // Should still be in Edit mode with an error on Due date.
        assert!(matches!(view.mode, ViewMode::Edit));
        let due_error = view
            .form
            .as_ref()
            .unwrap()
            .fields
            .iter()
            .find(|f| f.label == "Due date")
            .unwrap()
            .error
            .as_deref()
            .expect("Due date field should have an error");
        assert!(
            due_error.contains("invalid date"),
            "error should mention 'invalid date', got: {due_error}"
        );
    }

    #[test]
    fn field_error_clears_on_typing() {
        let db = test_db();
        let mut view = TodoView::new();
        view.handle_key(key(KeyCode::Char('a')), &db);

        // Submit with empty title to trigger an error.
        // Navigate to last field and submit.
        view.handle_key(key(KeyCode::Tab), &db); // -> Description
        view.handle_key(key(KeyCode::Tab), &db); // -> Priority
        view.handle_key(key(KeyCode::Tab), &db); // -> Due date
        view.handle_key(key(KeyCode::Tab), &db); // -> Tags
        view.handle_key(key(KeyCode::Enter), &db);

        // Confirm Title has an error.
        let title_has_error = view
            .form
            .as_ref()
            .unwrap()
            .fields
            .iter()
            .find(|f| f.label == "Title")
            .unwrap()
            .error
            .is_some();
        assert!(title_has_error, "Title should have an error after empty submit");

        // Navigate back to Title field (BackTab from Tags -> Due date -> Priority -> Description -> Title).
        view.handle_key(key(KeyCode::BackTab), &db);
        view.handle_key(key(KeyCode::BackTab), &db);
        view.handle_key(key(KeyCode::BackTab), &db);
        view.handle_key(key(KeyCode::BackTab), &db);

        // Type a character — this should clear the error.
        view.handle_key(key(KeyCode::Char('X')), &db);

        let title_error_after = view
            .form
            .as_ref()
            .unwrap()
            .fields
            .iter()
            .find(|f| f.label == "Title")
            .unwrap()
            .error
            .as_deref();
        assert_eq!(title_error_after, None, "error should clear after typing");
    }

    // --- Navigation flow tests ------------------------------------------------

    #[test]
    fn search_preserves_selection_after_exit() {
        let db = test_db();
        // Create 3 todos with distinct names.
        TodoRepository::create(
            &db,
            CreateTodo {
                title: "AAA".to_string(),
                description: None,
                priority: Priority::Low,
                due_date: None,
            },
        )
        .unwrap();
        TodoRepository::create(
            &db,
            CreateTodo {
                title: "BBB".to_string(),
                description: None,
                priority: Priority::Medium,
                due_date: None,
            },
        )
        .unwrap();
        let ccc = TodoRepository::create(
            &db,
            CreateTodo {
                title: "CCC".to_string(),
                description: None,
                priority: Priority::High,
                due_date: None,
            },
        )
        .unwrap();

        let mut view = TodoView::new();
        view.reload(&db);
        assert_eq!(view.list.items().len(), 3);

        // Start search, type "CCC".
        view.handle_key(key(KeyCode::Char('/')), &db);
        assert!(view.list.is_searching());

        view.handle_key(key(KeyCode::Char('C')), &db);
        view.handle_key(key(KeyCode::Char('C')), &db);
        view.handle_key(key(KeyCode::Char('C')), &db);

        // Press Enter to confirm — should open edit for CCC.
        view.handle_key(key(KeyCode::Enter), &db);

        assert!(matches!(view.mode, ViewMode::Edit));
        assert_eq!(view.edit_id, Some(ccc.id), "edit_id should match CCC's id");
    }

    #[test]
    fn esc_from_add_returns_to_list() {
        let db = test_db();
        let mut view = TodoView::new();
        view.handle_key(key(KeyCode::Char('a')), &db);
        assert!(matches!(view.mode, ViewMode::Add));
        assert!(view.form.is_some());

        view.handle_key(key(KeyCode::Esc), &db);
        assert!(matches!(view.mode, ViewMode::List));
        assert!(view.form.is_none());
    }

    #[test]
    fn esc_from_edit_returns_to_list() {
        let db = seeded_db();
        let mut view = TodoView::new();
        view.reload(&db);

        view.handle_key(key(KeyCode::Char('e')), &db);
        assert!(matches!(view.mode, ViewMode::Edit));
        assert!(view.form.is_some());

        view.handle_key(key(KeyCode::Esc), &db);
        assert!(matches!(view.mode, ViewMode::List));
        assert!(view.form.is_none());
    }
}
