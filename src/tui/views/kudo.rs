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

    fn reload(&mut self, db: &Database) {
        self.list.set_items(KudoRepository::list(db, KudoFilter { include_deleted: self.show_deleted, ..Default::default() }).unwrap_or_default());
    }

    fn build_add_form() -> Form {
        Form::new("Add Kudo", vec![
            FormField::text("Title", "", true),
            FormField::text("Description", "", false),
            FormField::text("From", "", false),
            FormField::text("From Slack", "", false),
            FormField::text("To", "", false),
            FormField::text("To Slack", "", false),
            FormField::text("Date", &Local::now().date_naive().to_string(), true),
            FormField::text("Tags", "", false),
        ])
    }

    fn build_edit_form(k: &Kudo) -> Form {
        Form::new("Edit Kudo", vec![
            FormField::text("Title", &k.title, true),
            FormField::text("Description", k.description.as_deref().unwrap_or(""), false),
            FormField::text("From", k.from_name.as_deref().unwrap_or(""), false),
            FormField::text("From Slack", k.from_slack.as_deref().unwrap_or(""), false),
            FormField::text("To", k.to_name.as_deref().unwrap_or(""), false),
            FormField::text("To Slack", k.to_slack.as_deref().unwrap_or(""), false),
            FormField::text("Date", &k.date.to_string(), true),
            FormField::text("Tags", &k.tags.join(", "), false),
        ])
    }

    fn submit_add(&mut self, db: &Database) {
        let form = match self.form.as_ref() { Some(f) => f, None => return };
        let title = form.value("Title").to_string();
        if title.is_empty() { self.status_msg = Some("Title is required.".to_string()); return; }
        let date = match crate::cli::parse_date(form.value("Date")) {
            Ok(d) => d, Err(e) => { self.status_msg = Some(format!("Error: {e}")); return; }
        };
        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));
        match KudoRepository::create(db, CreateKudo {
            title: title.clone(), description: form.value_opt("Description").map(|s| s.to_string()),
            from_name: form.value_opt("From").map(|s| s.to_string()), from_slack: form.value_opt("From Slack").map(|s| s.to_string()),
            to_name: form.value_opt("To").map(|s| s.to_string()), to_slack: form.value_opt("To Slack").map(|s| s.to_string()),
            date,
        }) {
            Ok(k) => {
                if !tag_names.is_empty() { let _ = TagRepository::set_tags_by_name(db, EntityType::Kudo, k.id, &tag_names); }
                self.status_msg = Some(format!("Kudo #{} created.", k.id)); self.mode = ViewMode::List; self.form = None; self.reload(db);
            }
            Err(e) => self.status_msg = Some(format!("Error: {e}")),
        }
    }

    fn submit_edit(&mut self, db: &Database) {
        let (form, edit_id) = match (self.form.as_ref(), self.edit_id) { (Some(f), Some(id)) => (f, id), _ => return };
        let title = form.value("Title").to_string();
        if title.is_empty() { self.status_msg = Some("Title is required.".to_string()); return; }
        let date = match crate::cli::parse_date(form.value("Date")) {
            Ok(d) => d, Err(e) => { self.status_msg = Some(format!("Error: {e}")); return; }
        };
        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));
        match KudoRepository::update(db, edit_id, UpdateKudo {
            title: Some(title), description: Some(form.value_opt("Description").map(|s| s.to_string())),
            from_name: Some(form.value_opt("From").map(|s| s.to_string())), from_slack: Some(form.value_opt("From Slack").map(|s| s.to_string())),
            to_name: Some(form.value_opt("To").map(|s| s.to_string())), to_slack: Some(form.value_opt("To Slack").map(|s| s.to_string())),
            date: Some(date),
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
        if !self.loaded { self.reload(db); self.loaded = true; }
        match self.mode {
            ViewMode::List => {
                if self.list.is_searching() {
                    use crate::tui::widgets::list::SearchAction;
                    match self.list.handle_search_key(key, |k| format!("{} {} {}", k.title, k.from_name.as_deref().unwrap_or(""), k.tags.join(" "))) {
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
                        if let Some(k) = self.list.selected() { self.edit_id = Some(k.id); self.form = Some(Self::build_edit_form(k)); self.mode = ViewMode::Edit; }
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
    use crossterm::event::KeyModifiers;

    fn test_db() -> Database { Database::open_in_memory().unwrap() }
    fn key(code: KeyCode) -> KeyEvent { KeyEvent::new(code, KeyModifiers::NONE) }

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
}
