use chrono::Local;
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, ListItem, Paragraph};
use ratatui::Frame;

use crate::db::kudo::{CreateKudo, KudoFilter, KudoRepository, UpdateKudo};
use crate::db::repository::CrudRepository;
use crate::db::goal::{GoalFilter, GoalRepository};
use crate::db::tag::{EntityType, TagRepository};
use crate::db::Database;
use crate::models::kudo::Kudo;
use crate::tui::widgets::form::{Form, FormAction, FormField};
use crate::tui::widgets::list::SelectableList;
use crate::tui::widgets::picker::{Picker, PickerAction, PickerItem};
use crate::tui::{View, ViewAction, ViewMode};

pub struct KudoView {
    list: SelectableList<Kudo>,
    mode: ViewMode,
    form: Option<Form>,
    picker: Option<Picker>,
    edit_id: Option<i64>,
    status_msg: Option<String>,
    loaded: bool,
    show_deleted: bool,
}

impl KudoView {
    pub fn new() -> Self {
        Self { list: SelectableList::new("Kudos"), mode: ViewMode::List, form: None, picker: None, edit_id: None, status_msg: None, loaded: false, show_deleted: false }
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
        if let Some(k) = self.list.items().iter().find(|k| k.id == id) {
            self.edit_id = Some(k.id);
            self.form = Some(Self::build_edit_form(k));
            self.mode = ViewMode::Edit;
        } else {
            self.status_msg = Some(format!("Kudo #{id} not found."));
        }
    }

    fn reload(&mut self, db: &Database) {
        self.list.set_items(KudoRepository::list(db, KudoFilter { include_deleted: self.show_deleted, ..Default::default() }).unwrap_or_default());
    }

    fn build_add_form() -> Form {
        Form::new("Add Kudo", vec![
            FormField::text("Title", "", true, ""),
            FormField::text("Description", "", false, ""),
            FormField::text("From", "", false, ""),
            FormField::text("From Slack", "", false, ""),
            FormField::text("To", "", false, ""),
            FormField::text("To Slack", "", false, ""),
            FormField::text("Date", &Local::now().date_naive().to_string(), true, "YYYY-MM-DD"),
            FormField::text("Tags", "", false, "tag1, tag2"),
        ])
    }

    fn build_edit_form(k: &Kudo) -> Form {
        Form::new("Edit Kudo", vec![
            FormField::text("Title", &k.title, true, ""),
            FormField::text("Description", k.description.as_deref().unwrap_or(""), false, ""),
            FormField::text("From", k.from_name.as_deref().unwrap_or(""), false, ""),
            FormField::text("From Slack", k.from_slack.as_deref().unwrap_or(""), false, ""),
            FormField::text("To", k.to_name.as_deref().unwrap_or(""), false, ""),
            FormField::text("To Slack", k.to_slack.as_deref().unwrap_or(""), false, ""),
            FormField::text("Date", &k.date.to_string(), true, "YYYY-MM-DD"),
            FormField::text("Tags", &k.tags.join(", "), false, "tag1, tag2"),
        ])
    }

    fn submit_add(&mut self, db: &Database) {
        let form = match self.form.as_mut() { Some(f) => f, None => return };
        form.clear_errors();
        let title = match form.require_non_empty("Title") { Some(t) => t, None => return };
        let date = match crate::cli::parse_date(form.value("Date")) {
            Ok(d) => d, Err(e) => { form.set_field_error("Date", format!("{e}")); return; }
        };
        let description = form.value_opt("Description").map(|s| s.to_string());
        let from_name = form.value_opt("From").map(|s| s.to_string());
        let from_slack = form.value_opt("From Slack").map(|s| s.to_string());
        let to_name = form.value_opt("To").map(|s| s.to_string());
        let to_slack = form.value_opt("To Slack").map(|s| s.to_string());
        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));
        match KudoRepository::create(db, CreateKudo {
            title: title.clone(), description, from_name, from_slack, to_name, to_slack, date,
        }) {
            Ok(k) => {
                if !tag_names.is_empty() { let _ = TagRepository::set_tags_by_name(db, EntityType::Kudo, k.id, &tag_names); }
                self.status_msg = Some(format!("Kudo #{} created.", k.id)); self.mode = ViewMode::List; self.form = None; self.reload(db);
            }
            Err(e) => self.status_msg = Some(format!("Error: {e}")),
        }
    }

    fn submit_edit(&mut self, db: &Database) {
        let edit_id = match self.edit_id { Some(id) => id, None => return };
        let form = match self.form.as_mut() { Some(f) => f, None => return };
        form.clear_errors();
        let title = match form.require_non_empty("Title") { Some(t) => t, None => return };
        let date = match crate::cli::parse_date(form.value("Date")) {
            Ok(d) => d, Err(e) => { form.set_field_error("Date", format!("{e}")); return; }
        };
        let description = Some(form.value_opt("Description").map(|s| s.to_string()));
        let from_name = Some(form.value_opt("From").map(|s| s.to_string()));
        let from_slack = Some(form.value_opt("From Slack").map(|s| s.to_string()));
        let to_name = Some(form.value_opt("To").map(|s| s.to_string()));
        let to_slack = Some(form.value_opt("To Slack").map(|s| s.to_string()));
        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));
        match KudoRepository::update(db, edit_id, UpdateKudo {
            title: Some(title), description, from_name, from_slack, to_name, to_slack, date: Some(date),
        }) {
            Ok(_) => {
                let _ = TagRepository::set_tags_by_name(db, EntityType::Kudo, edit_id, &tag_names);
                self.status_msg = Some(format!("Kudo #{edit_id} updated.")); self.mode = ViewMode::List; self.form = None; self.edit_id = None; self.reload(db);
            }
            Err(e) => self.status_msg = Some(format!("Error: {e}")),
        }
    }
}

impl View for KudoView {
    fn draw(&mut self, frame: &mut Frame, area: Rect, db: &Database) {
        if !self.loaded { self.reload(db); self.loaded = true; }
        match self.mode {
            ViewMode::List => {
                let v = Layout::vertical([Constraint::Min(0), Constraint::Length(1), Constraint::Length(1)]).split(area);
                self.list.draw_or_empty(frame, v[0], "No kudos. Press 'a' to add.", render_kudo_item);
                if let Some(msg) = &self.status_msg {
                    frame.render_widget(Paragraph::new(Line::from(Span::styled(format!(" {msg}"), Style::default().fg(Color::Yellow)))), v[1]);
                }
                frame.render_widget(Paragraph::new(Line::from(vec![
                    Span::styled(" a", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)), Span::raw(":add "),
                    Span::styled("e", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)), Span::raw(":edit "),
                    Span::styled("Enter", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)), Span::raw(":detail "),
                    Span::styled("q", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)), Span::raw(":back"),
                ])), v[2]);
            }
            ViewMode::Detail => {
                if let Some(kudo) = self.list.selected() { draw_detail(frame, area, kudo, db); }
            }
            ViewMode::Add | ViewMode::Edit => { if let Some(form) = &self.form { form.draw(frame, area); } }
            ViewMode::LinkPicker => {
                if let Some(kudo) = self.list.selected() { draw_detail(frame, area, kudo, db); }
                if let Some(ref mut picker) = self.picker { picker.draw(frame, area); }
            }
        }
    }
    fn handle_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction {
        match self.mode {
            ViewMode::List => {
                if self.list.is_searching() {
                    use crate::tui::widgets::list::SearchAction;
                    if let SearchAction::ExitWithSelection = self.list.handle_search_key(key, |k| format!("{} {} {}", k.title, k.from_name.as_deref().unwrap_or(""), k.tags.join(" "))) {
                        if let Some(id) = self.list.selected().map(|k| k.id) {
                            self.open_edit_by_id(id);
                        }
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
                        if let Some(id) = self.list.selected().map(|k| k.id) { self.open_edit_by_id(id); }
                        ViewAction::Nothing
                    }
                    KeyCode::Delete => {
                        if let Some(k) = self.list.selected() { let id = k.id;
                            match KudoRepository::soft_delete(db, id) {
                                Ok(()) => { self.status_msg = Some(format!("Kudo #{id} deleted.")); self.reload(db); }
                                Err(e) => self.status_msg = Some(format!("Error: {e}")),
                            }
                        } ViewAction::Nothing
                    }
                    KeyCode::Char('d') => {
                        self.show_deleted = !self.show_deleted;
                        self.status_msg = Some(if self.show_deleted { "Showing deleted.".to_string() } else { "Hiding deleted.".to_string() });
                        self.reload(db); ViewAction::Nothing
                    }
                    KeyCode::Char('R') => {
                        if let Some(k) = self.list.selected() { let id = k.id;
                            match KudoRepository::restore(db, id) {
                                Ok(()) => { self.status_msg = Some(format!("Kudo #{id} restored.")); self.reload(db); }
                                Err(e) => self.status_msg = Some(format!("Error: {e}")),
                            }
                        } ViewAction::Nothing
                    }
                    _ => ViewAction::Nothing,
                }
            }
            ViewMode::Detail => match key.code {
                KeyCode::Esc | KeyCode::Char('q') => { self.mode = ViewMode::List; ViewAction::Nothing }
                KeyCode::Char('L') => {
                    let goals = GoalRepository::list(db, GoalFilter::default()).unwrap_or_default();
                    let items: Vec<PickerItem> = goals.iter().map(|g| PickerItem { id: g.id, label: g.title.clone() }).collect();
                    self.picker = Some(Picker::new("Link to Goal", items));
                    self.mode = ViewMode::LinkPicker;
                    ViewAction::Nothing
                }
                _ => ViewAction::Nothing,
            },
            ViewMode::Add => {
                if let Some(form) = &mut self.form {
                    match form.handle_key(key) { FormAction::Submit => self.submit_add(db), FormAction::Cancel => { self.mode = ViewMode::List; self.form = None; } FormAction::Editing => {} }
                } ViewAction::Nothing
            }
            ViewMode::Edit => {
                if let Some(form) = &mut self.form {
                    match form.handle_key(key) { FormAction::Submit => self.submit_edit(db), FormAction::Cancel => { self.mode = ViewMode::List; self.form = None; self.edit_id = None; } FormAction::Editing => {} }
                } ViewAction::Nothing
            }
            ViewMode::LinkPicker => {
                if let Some(ref mut picker) = self.picker {
                    match picker.handle_key(key) {
                        PickerAction::Selected(goal_id) => {
                            if let Some(kudo) = self.list.selected() {
                                let kudo_id = kudo.id;
                                match KudoRepository::link_goal(db, kudo_id, goal_id) {
                                    Ok(()) => self.status_msg = Some(format!("Linked to Goal #{goal_id}.")),
                                    Err(e) => self.status_msg = Some(format!("Error: {e}")),
                                }
                            }
                            self.picker = None;
                            self.mode = ViewMode::Detail;
                        }
                        PickerAction::Cancelled => { self.picker = None; self.mode = ViewMode::Detail; }
                        PickerAction::Browsing => {}
                    }
                }
                ViewAction::Nothing
            }
        }
    }
}

fn render_kudo_item(kudo: &Kudo, _selected: bool) -> ListItem<'static> {
    let from = kudo.from_name.clone().unwrap_or_else(|| "?".to_string());
    let to = kudo.to_name.clone().unwrap_or_else(|| "me".to_string());
    ListItem::new(Line::from(vec![
        Span::styled(format!(" #{:<4}", kudo.id), Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{} ", kudo.date), Style::default().fg(Color::Gray)),
        Span::styled(format!("{from} → {to}  "), Style::default().fg(Color::Magenta)),
        Span::raw(kudo.title.clone()),
    ]))
}

fn draw_detail(frame: &mut Frame, area: Rect, kudo: &Kudo, db: &Database) {
    let block = Block::default().borders(Borders::ALL).title(format!(" Kudo #{} ", kudo.id));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let mut lines = vec![
        Line::from(vec![Span::styled("  Title: ", Style::default().add_modifier(Modifier::BOLD)), Span::raw(kudo.title.clone())]),
    ];
    if let Some(desc) = &kudo.description { lines.push(Line::from(format!("  Description: {desc}"))); }
    if let Some(name) = &kudo.from_name { lines.push(Line::from(format!("  From: {name}"))); }
    if let Some(slack) = &kudo.from_slack { lines.push(Line::from(format!("  From Slack: {slack}"))); }
    if let Some(name) = &kudo.to_name { lines.push(Line::from(format!("  To: {name}"))); }
    if let Some(slack) = &kudo.to_slack { lines.push(Line::from(format!("  To Slack: {slack}"))); }
    lines.push(Line::from(format!("  Date: {}", kudo.date)));

    if let Ok(goals) = KudoRepository::get_linked_goals(db, kudo.id)
        && !goals.is_empty() {
            lines.push(Line::from("")); lines.push(Line::from(Span::styled("  Linked Goals:", Style::default().add_modifier(Modifier::BOLD))));
            for g in &goals { lines.push(Line::from(format!("    #{} [{}] {}", g.id, g.status, g.title))); }
        }
    lines.push(Line::from("")); lines.push(Line::from(Span::styled("  Press Esc to go back", Style::default().fg(Color::DarkGray))));
    frame.render_widget(Paragraph::new(lines), inner);
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use crate::tui::testutil::{key, test_db};

    #[test]
    fn q_pops() { let db = test_db(); let mut v = KudoView::new(); assert!(matches!(v.handle_key(key(KeyCode::Char('q')), &db), ViewAction::Pop)); }

    #[test]
    fn a_opens_add() { let db = test_db(); let mut v = KudoView::new(); v.handle_key(key(KeyCode::Char('a')), &db); assert!(matches!(v.mode, ViewMode::Add)); }

    #[test]
    fn render_seeded() {
        let db = test_db();
        KudoRepository::create(&db, CreateKudo {
            title: "Nice work".to_string(), description: None,
            from_name: Some("Alice".to_string()), from_slack: None, to_name: None, to_slack: None,
            date: NaiveDate::from_ymd_opt(2026, 4, 1).unwrap(),
        }).unwrap();
        let mut v = KudoView::new(); v.reload(&db);
        let backend = ratatui::backend::TestBackend::new(100, 20);
        let mut terminal = ratatui::Terminal::new(backend).unwrap();
        terminal.draw(|f| v.draw(f, f.area(), &db)).unwrap();
        let buf = terminal.backend().buffer().clone();
        let mut out = String::new();
        for y in 0..buf.area.height { for x in 0..buf.area.width { out.push_str(buf[(x, y)].symbol()); } }
        assert!(out.contains("Nice work"));
    }

    fn seed_kudo(db: &Database) -> Kudo {
        KudoRepository::create(db, CreateKudo {
            title: "Nice work".to_string(), description: None,
            from_name: Some("Alice".to_string()), from_slack: None, to_name: None, to_slack: None,
            date: NaiveDate::from_ymd_opt(2026, 4, 1).unwrap(),
        }).unwrap()
    }

    #[test]
    fn loads_on_first_draw() {
        let db = test_db();
        seed_kudo(&db);
        let mut v = KudoView::new();
        // Do NOT call reload or handle_key — draw itself should load items.
        let backend = ratatui::backend::TestBackend::new(100, 20);
        let mut terminal = ratatui::Terminal::new(backend).unwrap();
        terminal.draw(|f| v.draw(f, f.area(), &db)).unwrap();
        assert!(!v.list.items().is_empty());
    }

    #[test]
    fn e_opens_edit() {
        let db = test_db();
        let kudo = seed_kudo(&db);
        let mut v = KudoView::new();
        v.reload(&db);
        v.handle_key(key(KeyCode::Char('e')), &db);
        assert!(matches!(v.mode, ViewMode::Edit));
        assert_eq!(v.edit_id, Some(kudo.id));
    }

    #[test]
    fn search_enter_opens_edit() {
        let db = test_db();
        seed_kudo(&db);
        let mut v = KudoView::new();
        v.reload(&db);
        v.handle_key(key(KeyCode::Char('/')), &db);
        v.handle_key(key(KeyCode::Char('N')), &db);
        v.handle_key(key(KeyCode::Char('i')), &db);
        v.handle_key(key(KeyCode::Char('c')), &db);
        v.handle_key(key(KeyCode::Enter), &db);
        assert!(matches!(v.mode, ViewMode::Edit));
    }

    #[test]
    fn submit_add_missing_title() {
        let db = test_db();
        let mut v = KudoView::new();
        v.handle_key(key(KeyCode::Char('a')), &db);
        assert!(matches!(v.mode, ViewMode::Add));
        // Navigate to last field (Tags, index 7) and press Enter to submit.
        // Form has 8 fields; we are at index 0, need 7 Tabs then Enter.
        for _ in 0..7 {
            v.handle_key(key(KeyCode::Tab), &db);
        }
        v.handle_key(key(KeyCode::Enter), &db);
        // Should still be in Add mode with Title error.
        assert!(matches!(v.mode, ViewMode::Add));
        let form = v.form.as_ref().unwrap();
        let title_field = form.fields.iter().find(|f| f.label == "Title").unwrap();
        assert!(title_field.error.is_some());
    }

    #[test]
    fn submit_add_invalid_date() {
        let db = test_db();
        let mut v = KudoView::new();
        v.handle_key(key(KeyCode::Char('a')), &db);
        // Type a title.
        v.handle_key(key(KeyCode::Char('T')), &db);
        v.handle_key(key(KeyCode::Char('e')), &db);
        v.handle_key(key(KeyCode::Char('s')), &db);
        v.handle_key(key(KeyCode::Char('t')), &db);
        // Navigate to Date field (index 6): 6 Tabs from index 0.
        for _ in 0..6 {
            v.handle_key(key(KeyCode::Tab), &db);
        }
        // Clear the default date value (10 chars for "YYYY-MM-DD").
        for _ in 0..10 {
            v.handle_key(key(KeyCode::Backspace), &db);
        }
        // Type invalid date.
        for c in "baddate".chars() {
            v.handle_key(key(KeyCode::Char(c)), &db);
        }
        // Navigate to last field (Tags, index 7) and submit.
        v.handle_key(key(KeyCode::Tab), &db);
        v.handle_key(key(KeyCode::Enter), &db);
        // Should still be in Add mode with Date error.
        assert!(matches!(v.mode, ViewMode::Add));
        let form = v.form.as_ref().unwrap();
        let date_field = form.fields.iter().find(|f| f.label == "Date").unwrap();
        assert!(date_field.error.is_some());
    }

    #[test]
    fn submit_add_success() {
        let db = test_db();
        let mut v = KudoView::new();
        v.reload(&db);
        assert_eq!(v.list.items().len(), 0);
        v.handle_key(key(KeyCode::Char('a')), &db);
        // Type a title.
        for c in "Great job".chars() {
            v.handle_key(key(KeyCode::Char(c)), &db);
        }
        // Date field already has today's date as default, so just navigate to last field and submit.
        for _ in 0..7 {
            v.handle_key(key(KeyCode::Tab), &db);
        }
        v.handle_key(key(KeyCode::Enter), &db);
        // Should return to List mode with one item.
        assert!(matches!(v.mode, ViewMode::List));
        assert_eq!(v.list.items().len(), 1);
    }

    #[test]
    fn delete_and_restore() {
        let db = test_db();
        seed_kudo(&db);
        let mut v = KudoView::new();
        v.reload(&db);
        assert_eq!(v.list.items().len(), 1);
        // Delete the selected kudo.
        v.handle_key(key(KeyCode::Delete), &db);
        assert_eq!(v.list.items().len(), 0);
        // Toggle show_deleted to see it.
        v.handle_key(key(KeyCode::Char('d')), &db);
        assert_eq!(v.list.items().len(), 1);
        // Restore it.
        v.handle_key(key(KeyCode::Char('R')), &db);
        // Toggle show_deleted off — item should still be visible (restored).
        v.handle_key(key(KeyCode::Char('d')), &db);
        assert_eq!(v.list.items().len(), 1);
    }
}
