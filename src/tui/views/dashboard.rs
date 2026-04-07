use crossterm::event::{KeyCode, KeyEvent};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::db::goal::{GoalFilter, GoalRepository};
use crate::db::kudo::{KudoFilter, KudoRepository};
use crate::db::repository::CrudRepository;
use crate::db::til::{TilFilter, TilRepository};
use crate::db::todo::{TodoFilter, TodoRepository};
use crate::db::Database;
use crate::models::goal::GoalStatus;
use crate::models::todo::TodoStatus;
use crate::tui::widgets::picker::{Picker, PickerAction, PickerItem};
use crate::tui::{View, ViewAction};

pub struct DashboardView {
    picker: Option<Picker>,
    searching: bool,
}

impl DashboardView {
    pub fn new() -> Self {
        Self { picker: None, searching: false }
    }

    fn build_global_picker(db: &Database) -> Picker {
        let mut items = Vec::new();

        for todo in TodoRepository::list(db, TodoFilter::default()).unwrap_or_default() {
            items.push(PickerItem { id: todo.id, label: format!("[todo] {}", todo.title) });
        }
        for goal in GoalRepository::list(db, GoalFilter::default()).unwrap_or_default() {
            items.push(PickerItem { id: goal.id, label: format!("[goal] {}", goal.title) });
        }
        for kudo in KudoRepository::list(db, KudoFilter::default()).unwrap_or_default() {
            items.push(PickerItem { id: kudo.id, label: format!("[kudo] {}", kudo.title) });
        }
        for til in TilRepository::list(db, TilFilter::default()).unwrap_or_default() {
            items.push(PickerItem { id: til.id, label: format!("[til] {}", til.title) });
        }

        Picker::new("Search all", items)
    }
}

impl View for DashboardView {
    fn draw(&mut self, frame: &mut Frame, area: Rect, db: &Database) {
        // Query data for the dashboard.
        let all_todos = TodoRepository::list(db, TodoFilter::default()).unwrap_or_default();
        let in_progress: Vec<_> = all_todos
            .iter()
            .filter(|t| t.status == TodoStatus::InProgress)
            .collect();
        let pending: Vec<_> = all_todos
            .iter()
            .filter(|t| t.status == TodoStatus::Pending)
            .collect();
        let all_goals = GoalRepository::list(db, GoalFilter::default()).unwrap_or_default();
        let active_goals: Vec<_> = all_goals
            .iter()
            .filter(|g| g.status == GoalStatus::InProgress)
            .collect();
        let all_kudos = KudoRepository::list(db, KudoFilter::default()).unwrap_or_default();
        let all_tils = TilRepository::list(db, TilFilter::default()).unwrap_or_default();

        // Layout: header + 2 columns.
        let vertical = Layout::vertical([
            Constraint::Length(3), // header
            Constraint::Min(0),   // body
            Constraint::Length(1), // footer
        ])
        .split(area);

        let body_cols = Layout::horizontal([
            Constraint::Percentage(50),
            Constraint::Percentage(50),
        ])
        .split(vertical[1]);

        // Header.
        let header = Paragraph::new(Line::from(vec![
            Span::styled(" rmbr ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw("— your second brain at work"),
        ]))
        .block(Block::default().borders(Borders::BOTTOM));
        frame.render_widget(header, vertical[0]);

        // Left column: Todos.
        let mut todo_lines = vec![
            Line::from(Span::styled(
                format!(" {} todos ({} in progress, {} pending)",
                    all_todos.len(), in_progress.len(), pending.len()),
                Style::default().fg(Color::Yellow),
            )),
            Line::from(""),
        ];

        if in_progress.is_empty() && pending.is_empty() {
            todo_lines.push(Line::from("  No active todos."));
        } else {
            for todo in in_progress.iter().take(8) {
                let due = todo.due_date.map_or(String::new(), |d| format!(" due:{d}"));
                todo_lines.push(Line::from(format!(
                    "  ▶ #{} {}{}", todo.id, todo.title, due,
                )));
            }
            for todo in pending.iter().take(5) {
                let due = todo.due_date.map_or(String::new(), |d| format!(" due:{d}"));
                todo_lines.push(Line::from(format!(
                    "  ○ #{} {}{}", todo.id, todo.title, due,
                )));
            }
        }

        let todo_panel = Paragraph::new(todo_lines)
            .block(Block::default().borders(Borders::ALL).title(" Todos "));
        frame.render_widget(todo_panel, body_cols[0]);

        // Right column: Goals + Kudos + TILs.
        let right_sections = Layout::vertical([
            Constraint::Percentage(40),
            Constraint::Percentage(35),
            Constraint::Percentage(25),
        ])
        .split(body_cols[1]);

        // Goals section.
        let mut goal_lines = vec![
            Line::from(Span::styled(
                format!(" {} goals ({} active)", all_goals.len(), active_goals.len()),
                Style::default().fg(Color::Green),
            )),
            Line::from(""),
        ];
        for goal in all_goals.iter().take(5) {
            goal_lines.push(Line::from(format!(
                "  {} #{} {} (STAR:{}/4)",
                status_icon(goal.status), goal.id, goal.title, goal.star_completeness(),
            )));
        }
        if all_goals.is_empty() {
            goal_lines.push(Line::from("  No goals yet."));
        }

        let goal_panel = Paragraph::new(goal_lines)
            .block(Block::default().borders(Borders::ALL).title(" Goals "));
        frame.render_widget(goal_panel, right_sections[0]);

        // Kudos section.
        let mut kudo_lines = vec![
            Line::from(Span::styled(
                format!(" {} kudos", all_kudos.len()),
                Style::default().fg(Color::Magenta),
            )),
            Line::from(""),
        ];
        for kudo in all_kudos.iter().take(3) {
            let from = kudo.from_name.as_deref().unwrap_or("?");
            kudo_lines.push(Line::from(format!(
                "  ★ {} — from {} ({})", kudo.title, from, kudo.date,
            )));
        }
        if all_kudos.is_empty() {
            kudo_lines.push(Line::from("  No kudos yet."));
        }

        let kudo_panel = Paragraph::new(kudo_lines)
            .block(Block::default().borders(Borders::ALL).title(" Kudos "));
        frame.render_widget(kudo_panel, right_sections[1]);

        // TILs section.
        let mut til_lines = vec![
            Line::from(Span::styled(
                format!(" {} TILs", all_tils.len()),
                Style::default().fg(Color::Blue),
            )),
            Line::from(""),
        ];
        for til in all_tils.iter().take(3) {
            til_lines.push(Line::from(format!(
                "  💡 {} [{}]", til.title, til.category,
            )));
        }
        if all_tils.is_empty() {
            til_lines.push(Line::from("  No TILs yet."));
        }

        let til_panel = Paragraph::new(til_lines)
            .block(Block::default().borders(Borders::ALL).title(" TILs "));
        frame.render_widget(til_panel, right_sections[2]);

        // Footer with keybindings.
        let footer = Paragraph::new(Line::from(vec![
            Span::styled(" t", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw(":todos  "),
            Span::styled("g", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw(":goals  "),
            Span::styled("k", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw(":kudos  "),
            Span::styled("l", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw(":TILs  "),
            Span::styled("/", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw(":search  "),
            Span::styled("q", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
            Span::raw(":quit"),
        ]));
        frame.render_widget(footer, vertical[2]);

        // Draw search overlay if active.
        if let Some(ref mut picker) = self.picker {
            picker.draw(frame, area);
        }
    }

    fn handle_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction {
        // Search mode.
        if self.searching {
            if let Some(ref mut picker) = self.picker {
                match picker.handle_key(key) {
                    PickerAction::Selected(_id) => {
                        // Navigate to the entity view based on the label prefix.
                        // We encoded the type in the label as "[todo]", "[goal]", etc.
                        if let Some(item) = self.picker.as_ref().and_then(|p| p.selected_item()) {
                            let label = &item.label;
                            let view: Box<dyn View> = if label.starts_with("[todo]") {
                                Box::new(super::todo::TodoView::new())
                            } else if label.starts_with("[goal]") {
                                Box::new(super::goal::GoalView::new())
                            } else if label.starts_with("[kudo]") {
                                Box::new(super::kudo::KudoView::new())
                            } else {
                                Box::new(super::til::TilView::new())
                            };
                            self.picker = None;
                            self.searching = false;
                            return ViewAction::Push(view);
                        }
                        self.picker = None;
                        self.searching = false;
                    }
                    PickerAction::Cancelled => {
                        self.picker = None;
                        self.searching = false;
                    }
                    PickerAction::Browsing => {}
                }
            }
            return ViewAction::Nothing;
        }

        match key.code {
            KeyCode::Char('q') | KeyCode::Esc => ViewAction::Quit,
            KeyCode::Char('t') => ViewAction::Push(Box::new(super::todo::TodoView::new())),
            KeyCode::Char('g') => ViewAction::Push(Box::new(super::goal::GoalView::new())),
            KeyCode::Char('k') => ViewAction::Push(Box::new(super::kudo::KudoView::new())),
            KeyCode::Char('l') => ViewAction::Push(Box::new(super::til::TilView::new())),
            KeyCode::Char('/') => {
                self.picker = Some(Self::build_global_picker(db));
                self.searching = true;
                ViewAction::Nothing
            }
            _ => ViewAction::Nothing,
        }
    }
}

fn status_icon(status: GoalStatus) -> &'static str {
    match status {
        GoalStatus::NotStarted => "○",
        GoalStatus::InProgress => "▶",
        GoalStatus::Achieved => "✓",
        GoalStatus::Abandoned => "✗",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;

    use crate::db::goal::{CreateGoal, GoalRepository};
    use crate::db::kudo::{CreateKudo, KudoRepository};
    use crate::db::repository::CrudRepository;
    use crate::db::til::{CreateTil, TilRepository};
    use crate::db::todo::{CreateTodo, TodoRepository};
    use crate::models::til::TilCategory;
    use crate::models::todo::Priority;

    fn test_db() -> Database {
        Database::open_in_memory().unwrap()
    }

    fn key(code: KeyCode) -> KeyEvent {
        KeyEvent::new(code, KeyModifiers::NONE)
    }

    fn seed_data(db: &Database) {
        TodoRepository::create(
            db,
            CreateTodo {
                title: "Design API".to_string(),
                description: None,
                priority: Priority::High,
                due_date: None,
            },
        )
        .unwrap();
        GoalRepository::create(
            db,
            CreateGoal {
                title: "Ship feature X".to_string(),
                situation: Some("Team needs it".to_string()),
                task: None,
                action: None,
                result: None,
                due_date: None,
            },
        )
        .unwrap();
        KudoRepository::create(
            db,
            CreateKudo {
                title: "Great pairing".to_string(),
                description: None,
                from_name: Some("Alice".to_string()),
                from_slack: None,
                to_name: None,
                to_slack: None,
                date: chrono::NaiveDate::from_ymd_opt(2026, 4, 1).unwrap(),
            },
        )
        .unwrap();
        TilRepository::create(
            db,
            CreateTil {
                title: "Rust lifetimes".to_string(),
                body: "References must be valid".to_string(),
                source: None,
                category: TilCategory::Technical,
            },
        )
        .unwrap();
    }

    // --- handle_key tests ---------------------------------------------------

    #[test]
    fn q_quits() {
        let db = test_db();
        let mut view = DashboardView::new();
        assert!(matches!(view.handle_key(key(KeyCode::Char('q')), &db), ViewAction::Quit));
    }

    #[test]
    fn esc_quits() {
        let db = test_db();
        let mut view = DashboardView::new();
        assert!(matches!(view.handle_key(key(KeyCode::Esc), &db), ViewAction::Quit));
    }

    #[test]
    fn t_pushes_todo_view() {
        let db = test_db();
        let mut view = DashboardView::new();
        assert!(matches!(view.handle_key(key(KeyCode::Char('t')), &db), ViewAction::Push(_)));
    }

    #[test]
    fn nav_keys_push_views() {
        let db = test_db();
        let mut view = DashboardView::new();
        for code in [KeyCode::Char('g'), KeyCode::Char('k'), KeyCode::Char('l')] {
            assert!(matches!(view.handle_key(key(code), &db), ViewAction::Push(_)));
        }
    }

    #[test]
    fn unknown_key_returns_nothing() {
        let db = test_db();
        let mut view = DashboardView::new();
        assert!(matches!(view.handle_key(key(KeyCode::Char('z')), &db), ViewAction::Nothing));
    }

    // --- Render tests via TestBackend ---------------------------------------

    fn render_dashboard(db: &Database) -> String {
        let backend = TestBackend::new(100, 30);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut view = DashboardView::new();

        terminal
            .draw(|frame| {
                view.draw(frame, frame.area(), db);
            })
            .unwrap();

        // Extract all text from the buffer.
        let buffer = terminal.backend().buffer().clone();
        let mut output = String::new();
        for y in 0..buffer.area.height {
            for x in 0..buffer.area.width {
                let cell = &buffer[(x, y)];
                output.push_str(cell.symbol());
            }
            output.push('\n');
        }
        output
    }

    #[test]
    fn dashboard_renders_panel_titles() {
        let db = test_db();
        let output = render_dashboard(&db);

        assert!(output.contains("Todos"), "should contain Todos panel title");
        assert!(output.contains("Goals"), "should contain Goals panel title");
        assert!(output.contains("Kudos"), "should contain Kudos panel title");
        assert!(output.contains("TILs"), "should contain TILs panel title");
    }

    #[test]
    fn dashboard_renders_empty_state() {
        let db = test_db();
        let output = render_dashboard(&db);

        assert!(output.contains("No active todos"), "empty db should show no active todos");
        assert!(output.contains("No goals yet"), "empty db should show no goals");
        assert!(output.contains("No kudos yet"), "empty db should show no kudos");
        assert!(output.contains("No TILs yet"), "empty db should show no TILs");
    }

    #[test]
    fn dashboard_renders_seeded_data() {
        let db = test_db();
        seed_data(&db);
        let output = render_dashboard(&db);

        assert!(output.contains("Design API"), "should show todo title");
        assert!(output.contains("Ship feature X"), "should show goal title");
        assert!(output.contains("Great pairing"), "should show kudo title");
        assert!(output.contains("Rust lifetimes"), "should show TIL title");
    }

    #[test]
    fn dashboard_renders_keybinding_footer() {
        let db = test_db();
        let output = render_dashboard(&db);

        assert!(output.contains("t"), "footer should show t key");
        assert!(output.contains("goals"), "footer should mention goals");
        assert!(output.contains("quit"), "footer should mention quit");
    }

    #[test]
    fn dashboard_shows_entity_counts() {
        let db = test_db();
        seed_data(&db);
        let output = render_dashboard(&db);

        assert!(output.contains("1 todos"), "should show todo count");
        assert!(output.contains("1 goals"), "should show goal count");
        assert!(output.contains("1 kudos"), "should show kudo count");
        assert!(output.contains("1 TILs"), "should show TIL count");
    }

    #[test]
    fn slash_activates_search() {
        let db = test_db();
        seed_data(&db);
        let mut view = DashboardView::new();
        view.handle_key(key(KeyCode::Char('/')), &db);
        assert!(view.searching);
        assert!(view.picker.is_some());
    }

    #[test]
    fn search_esc_cancels() {
        let db = test_db();
        let mut view = DashboardView::new();
        view.handle_key(key(KeyCode::Char('/')), &db);
        assert!(view.searching);
        view.handle_key(key(KeyCode::Esc), &db);
        assert!(!view.searching);
        assert!(view.picker.is_none());
    }
}
