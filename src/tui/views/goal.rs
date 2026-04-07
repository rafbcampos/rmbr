use crossterm::event::{KeyCode, KeyEvent};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, ListItem, Paragraph};
use ratatui::Frame;

use crate::db::goal::{CreateGoal, GoalFilter, GoalRepository, UpdateGoal};
use crate::db::repository::CrudRepository;
use crate::db::tag::{EntityType, TagRepository};
use crate::db::Database;
use crate::models::goal::{Goal, GoalStatus};
use crate::tui::widgets::form::{Form, FormAction, FormField};
use crate::tui::widgets::list::SelectableList;
use crate::tui::{View, ViewAction, ViewMode};

pub struct GoalView {
    list: SelectableList<Goal>,
    mode: ViewMode,
    form: Option<Form>,
    edit_id: Option<i64>,
    status_msg: Option<String>,
    loaded: bool,
    show_deleted: bool,
}

impl GoalView {
    pub fn new() -> Self {
        Self {
            list: SelectableList::new("Goals"),
            mode: ViewMode::List,
            form: None,
            edit_id: None,
            status_msg: None,
            loaded: false,
            show_deleted: false,
        }
    }

    fn reload(&mut self, db: &Database) {
        let goals = GoalRepository::list(db, GoalFilter {
            include_deleted: self.show_deleted,
            ..Default::default()
        }).unwrap_or_default();
        self.list.set_items(goals);
    }

    fn build_add_form() -> Form {
        Form::new("Add Goal", vec![
            FormField::text("Title", "", true),
            FormField::text("Situation", "", false),
            FormField::text("Task", "", false),
            FormField::text("Due date", "", false),
            FormField::text("Tags", "", false),
        ])
    }

    fn build_edit_form(goal: &Goal) -> Form {
        Form::new("Edit Goal", vec![
            FormField::text("Title", &goal.title, true),
            FormField::text("Situation", goal.situation.as_deref().unwrap_or(""), false),
            FormField::text("Task", goal.task.as_deref().unwrap_or(""), false),
            FormField::text("Action", goal.action.as_deref().unwrap_or(""), false),
            FormField::text("Result", goal.result.as_deref().unwrap_or(""), false),
            FormField::select(
                "Status",
                vec!["not-started".to_string(), "in-progress".to_string(), "achieved".to_string(), "abandoned".to_string()],
                &goal.status.to_string(),
            ),
            FormField::text("Due date", &goal.due_date.map_or(String::new(), |d| d.to_string()), false),
            FormField::text("Tags", &goal.tags.join(", "), false),
        ])
    }

    fn submit_add(&mut self, db: &Database) {
        let form = match self.form.as_ref() { Some(f) => f, None => return };
        let title = form.value("Title").to_string();
        if title.is_empty() { self.status_msg = Some("Title is required.".to_string()); return; }

        let due_date = match crate::cli::parse_date_opt(&form.value_opt("Due date").map(|s| s.to_string())) {
            Ok(d) => d, Err(e) => { self.status_msg = Some(format!("Error: {e}")); return; }
        };

        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));

        match GoalRepository::create(db, CreateGoal {
            title: title.clone(),
            situation: form.value_opt("Situation").map(|s| s.to_string()),
            task: form.value_opt("Task").map(|s| s.to_string()),
            action: None, result: None, due_date,
        }) {
            Ok(g) => {
                if !tag_names.is_empty() {
                    let _ = TagRepository::set_tags_by_name(db, EntityType::Goal, g.id, &tag_names);
                }
                self.status_msg = Some(format!("Goal #{} '{}' created.", g.id, title));
                self.mode = ViewMode::List; self.form = None; self.reload(db);
            }
            Err(e) => self.status_msg = Some(format!("Error: {e}")),
        }
    }

    fn submit_edit(&mut self, db: &Database) {
        let (form, edit_id) = match (self.form.as_ref(), self.edit_id) { (Some(f), Some(id)) => (f, id), _ => return };
        let title = form.value("Title").to_string();
        if title.is_empty() { self.status_msg = Some("Title is required.".to_string()); return; }

        let status = form.value("Status").parse::<GoalStatus>().ok();
        let due_date = match crate::cli::parse_date_opt(&form.value_opt("Due date").map(|s| s.to_string())) {
            Ok(d) => d, Err(e) => { self.status_msg = Some(format!("Error: {e}")); return; }
        };

        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));

        match GoalRepository::update(db, edit_id, UpdateGoal {
            title: Some(title),
            situation: Some(form.value_opt("Situation").map(|s| s.to_string())),
            task: Some(form.value_opt("Task").map(|s| s.to_string())),
            action: Some(form.value_opt("Action").map(|s| s.to_string())),
            result: Some(form.value_opt("Result").map(|s| s.to_string())),
            status, due_date: Some(due_date),
        }) {
            Ok(_) => {
                let _ = TagRepository::set_tags_by_name(db, EntityType::Goal, edit_id, &tag_names);
                self.status_msg = Some(format!("Goal #{edit_id} updated."));
                self.mode = ViewMode::List; self.form = None; self.edit_id = None; self.reload(db);
            }
            Err(e) => self.status_msg = Some(format!("Error: {e}")),
        }
    }
}

impl View for GoalView {
    fn draw(&mut self, frame: &mut Frame, area: Rect, db: &Database) {
        match self.mode {
            ViewMode::List => {
                let vertical = Layout::vertical([Constraint::Min(0), Constraint::Length(1), Constraint::Length(1)]).split(area);
                self.list.draw_or_empty(frame, vertical[0], "No goals. Press 'a' to add.", render_goal_item);
                if let Some(msg) = &self.status_msg {
                    frame.render_widget(Paragraph::new(Line::from(Span::styled(format!(" {msg}"), Style::default().fg(Color::Yellow)))), vertical[1]);
                }
                frame.render_widget(Paragraph::new(Line::from(vec![
                    Span::styled(" a", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)), Span::raw(":add "),
                    Span::styled("e", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)), Span::raw(":edit "),
                    Span::styled("Enter", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)), Span::raw(":detail "),
                    Span::styled("q", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)), Span::raw(":back"),
                ])), vertical[2]);
            }
            ViewMode::Detail => {
                if let Some(goal) = self.list.selected() {
                    draw_detail(frame, area, goal, db);
                }
            }
            ViewMode::Add | ViewMode::Edit => {
                if let Some(form) = &self.form { form.draw(frame, area); }
            }
            _ => {}
        }
    }

    fn handle_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction {
        if !self.loaded { self.reload(db); self.loaded = true; }
        match self.mode {
            ViewMode::List => {
                if self.list.is_searching() {
                    use crate::tui::widgets::list::SearchAction;
                    match self.list.handle_search_key(key, |g| format!("{} {}", g.title, g.tags.join(" "))) {
                        SearchAction::ExitWithSelection if self.list.selected().is_some() => { self.mode = ViewMode::Detail; }
                        _ => {}
                    }
                    return ViewAction::Nothing;
                }
                if self.list.handle_key(key) { self.status_msg = None; return ViewAction::Nothing; }
                match key.code {
                    KeyCode::Char('/') => { self.list.start_search(); ViewAction::Nothing }
                    KeyCode::Esc | KeyCode::Char('q') => ViewAction::Pop,
                    KeyCode::Enter => { if self.list.selected().is_some() { self.mode = ViewMode::Detail; } ViewAction::Nothing }
                    KeyCode::Char('a') => { self.form = Some(Self::build_add_form()); self.mode = ViewMode::Add; ViewAction::Nothing }
                    KeyCode::Char('e') => {
                        if let Some(g) = self.list.selected() { self.edit_id = Some(g.id); self.form = Some(Self::build_edit_form(g)); self.mode = ViewMode::Edit; }
                        ViewAction::Nothing
                    }
                    KeyCode::Delete => {
                        if let Some(g) = self.list.selected() {
                            let id = g.id;
                            match GoalRepository::soft_delete(db, id) {
                                Ok(()) => { self.status_msg = Some(format!("Goal #{id} deleted.")); self.reload(db); }
                                Err(e) => self.status_msg = Some(format!("Error: {e}")),
                            }
                        }
                        ViewAction::Nothing
                    }
                    KeyCode::Char('d') => {
                        self.show_deleted = !self.show_deleted;
                        self.status_msg = Some(if self.show_deleted { "Showing deleted.".to_string() } else { "Hiding deleted.".to_string() });
                        self.reload(db); ViewAction::Nothing
                    }
                    KeyCode::Char('R') => {
                        if let Some(g) = self.list.selected() { let id = g.id;
                            match GoalRepository::restore(db, id) {
                                Ok(()) => { self.status_msg = Some(format!("Goal #{id} restored.")); self.reload(db); }
                                Err(e) => self.status_msg = Some(format!("Error: {e}")),
                            }
                        } ViewAction::Nothing
                    }
                    _ => ViewAction::Nothing,
                }
            }
            ViewMode::Detail => match key.code {
                KeyCode::Esc | KeyCode::Char('q') => { self.mode = ViewMode::List; ViewAction::Nothing }
                _ => ViewAction::Nothing,
            },
            ViewMode::Add => {
                if let Some(form) = &mut self.form {
                    match form.handle_key(key) {
                        FormAction::Submit => self.submit_add(db),
                        FormAction::Cancel => { self.mode = ViewMode::List; self.form = None; }
                        FormAction::Editing => {}
                    }
                }
                ViewAction::Nothing
            }
            ViewMode::Edit => {
                if let Some(form) = &mut self.form {
                    match form.handle_key(key) {
                        FormAction::Submit => self.submit_edit(db),
                        FormAction::Cancel => { self.mode = ViewMode::List; self.form = None; self.edit_id = None; }
                        FormAction::Editing => {}
                    }
                }
                ViewAction::Nothing
            }
            _ => ViewAction::Nothing,
        }
    }
}

fn render_goal_item(goal: &Goal, _selected: bool) -> ListItem<'static> {
    let status_color = match goal.status {
        GoalStatus::NotStarted => Color::Gray,
        GoalStatus::InProgress => Color::Green,
        GoalStatus::Achieved => Color::Cyan,
        GoalStatus::Abandoned => Color::Red,
    };
    let due = goal.due_date.map_or(String::new(), |d| format!(" due:{d}"));
    let line = Line::from(vec![
        Span::styled(format!(" #{:<4}", goal.id), Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{:12}", goal.status.to_string()), Style::default().fg(status_color)),
        Span::styled(format!("STAR:{}/4 ", goal.star_completeness()), Style::default().fg(Color::Yellow)),
        Span::raw(goal.title.clone()),
        Span::styled(due, Style::default().fg(Color::DarkGray)),
    ]);
    ListItem::new(line)
}

fn draw_detail(frame: &mut Frame, area: Rect, goal: &Goal, db: &Database) {
    let block = Block::default().borders(Borders::ALL).title(format!(" Goal #{} ", goal.id));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let mut lines = vec![
        Line::from(vec![Span::styled("  Title: ", Style::default().add_modifier(Modifier::BOLD)), Span::raw(goal.title.clone())]),
        Line::from(vec![Span::styled("  Status: ", Style::default().add_modifier(Modifier::BOLD)), Span::raw(goal.status.to_string())]),
        Line::from(vec![Span::styled("  STAR Completeness: ", Style::default().add_modifier(Modifier::BOLD)), Span::raw(format!("{}/4", goal.star_completeness()))]),
        Line::from(""),
    ];

    let star_fields = [("Situation", &goal.situation), ("Task", &goal.task), ("Action", &goal.action), ("Result", &goal.result)];
    for (label, value) in star_fields {
        let display = value.as_deref().unwrap_or("(not set)");
        let style = if value.is_some() { Style::default() } else { Style::default().fg(Color::DarkGray) };
        lines.push(Line::from(vec![
            Span::styled(format!("  {label}: "), Style::default().add_modifier(Modifier::BOLD)),
            Span::styled(display.to_string(), style),
        ]));
    }

    if let Some(due) = goal.due_date {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![Span::styled("  Due: ", Style::default().add_modifier(Modifier::BOLD)), Span::raw(due.to_string())]));
    }

    if let Ok(todos) = GoalRepository::get_linked_todos(db, goal.id)
        && !todos.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled("  Linked Todos:", Style::default().add_modifier(Modifier::BOLD))));
            for todo in &todos {
                lines.push(Line::from(format!("    #{} [{}] {}", todo.id, todo.status, todo.title)));
            }
        }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled("  Press Esc to go back", Style::default().fg(Color::DarkGray))));

    frame.render_widget(Paragraph::new(lines), inner);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::goal::{CreateGoal, GoalRepository};
    use crossterm::event::KeyModifiers;

    fn test_db() -> Database { Database::open_in_memory().unwrap() }
    fn key(code: KeyCode) -> KeyEvent { KeyEvent::new(code, KeyModifiers::NONE) }

    fn seeded_db() -> Database {
        let db = test_db();
        GoalRepository::create(&db, CreateGoal {
            title: "Ship feature".to_string(), situation: Some("Context".to_string()),
            task: None, action: None, result: None, due_date: None,
        }).unwrap();
        db
    }

    #[test]
    fn q_pops() { let db = test_db(); let mut v = GoalView::new(); assert!(matches!(v.handle_key(key(KeyCode::Char('q')), &db), ViewAction::Pop)); }

    #[test]
    fn loads_and_navigates() {
        let db = seeded_db();
        let mut v = GoalView::new();
        v.handle_key(key(KeyCode::Down), &db);
        assert_eq!(v.list.items().len(), 1);
    }

    #[test]
    fn enter_shows_detail() {
        let db = seeded_db();
        let mut v = GoalView::new();
        v.reload(&db);
        v.handle_key(key(KeyCode::Enter), &db);
        assert!(matches!(v.mode, ViewMode::Detail));
    }

    #[test]
    fn a_opens_add() {
        let db = test_db();
        let mut v = GoalView::new();
        v.handle_key(key(KeyCode::Char('a')), &db);
        assert!(matches!(v.mode, ViewMode::Add));
    }

    #[test]
    fn render_has_title() {
        let db = seeded_db();
        let mut v = GoalView::new();
        v.reload(&db);
        let backend = ratatui::backend::TestBackend::new(100, 20);
        let mut terminal = ratatui::Terminal::new(backend).unwrap();
        terminal.draw(|f| v.draw(f, f.area(), &db)).unwrap();
        let buf = terminal.backend().buffer().clone();
        let mut out = String::new();
        for y in 0..buf.area.height { for x in 0..buf.area.width { out.push_str(buf[(x, y)].symbol()); } }
        assert!(out.contains("Ship feature"));
    }
}
