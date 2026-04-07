use crossterm::event::{KeyCode, KeyEvent};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, ListItem, Paragraph};
use ratatui::Frame;

use crate::db::repository::CrudRepository;
use crate::db::til::{CreateTil, TilFilter, TilRepository, UpdateTil};
use crate::db::tag::{EntityType, TagRepository};
use crate::db::Database;
use crate::models::til::{Til, TilCategory};
use crate::tui::widgets::form::{Form, FormAction, FormField};
use crate::tui::widgets::list::SelectableList;
use crate::tui::{View, ViewAction, ViewMode};

pub struct TilView {
    list: SelectableList<Til>,
    mode: ViewMode,
    form: Option<Form>,
    edit_id: Option<i64>,
    status_msg: Option<String>,
    loaded: bool,
    show_deleted: bool,
}

impl TilView {
    pub fn new() -> Self {
        Self { list: SelectableList::new("TILs"), mode: ViewMode::List, form: None, edit_id: None, status_msg: None, loaded: false, show_deleted: false }
    }

    fn reload(&mut self, db: &Database) {
        self.list.set_items(TilRepository::list(db, TilFilter { include_deleted: self.show_deleted, ..Default::default() }).unwrap_or_default());
    }

    fn build_add_form() -> Form {
        Form::new("Add TIL", vec![
            FormField::text("Title", "", true),
            FormField::text("Body", "", true),
            FormField::text("Source", "", false),
            FormField::select("Category", vec!["technical".to_string(), "process".to_string(), "domain".to_string(), "people".to_string()], "technical"),
            FormField::text("Tags", "", false),
        ])
    }

    fn build_edit_form(t: &Til) -> Form {
        Form::new("Edit TIL", vec![
            FormField::text("Title", &t.title, true),
            FormField::text("Body", &t.body, true),
            FormField::text("Source", t.source.as_deref().unwrap_or(""), false),
            FormField::select("Category", vec!["technical".to_string(), "process".to_string(), "domain".to_string(), "people".to_string()], &t.category.to_string()),
            FormField::text("Tags", &t.tags.join(", "), false),
        ])
    }

    fn submit_add(&mut self, db: &Database) {
        let form = match self.form.as_ref() { Some(f) => f, None => return };
        let title = form.value("Title").to_string();
        let body = form.value("Body").to_string();
        if title.is_empty() || body.is_empty() { self.status_msg = Some("Title and Body are required.".to_string()); return; }
        let category = form.value("Category").parse::<TilCategory>().unwrap_or(TilCategory::Technical);
        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));
        match TilRepository::create(db, CreateTil {
            title: title.clone(), body, source: form.value_opt("Source").map(|s| s.to_string()), category,
        }) {
            Ok(t) => {
                if !tag_names.is_empty() { let _ = TagRepository::set_tags_by_name(db, EntityType::Til, t.id, &tag_names); }
                self.status_msg = Some(format!("TIL #{} created.", t.id)); self.mode = ViewMode::List; self.form = None; self.reload(db);
            }
            Err(e) => self.status_msg = Some(format!("Error: {e}")),
        }
    }

    fn submit_edit(&mut self, db: &Database) {
        let (form, edit_id) = match (self.form.as_ref(), self.edit_id) { (Some(f), Some(id)) => (f, id), _ => return };
        let title = form.value("Title").to_string();
        let body = form.value("Body").to_string();
        if title.is_empty() || body.is_empty() { self.status_msg = Some("Title and Body are required.".to_string()); return; }
        let category = form.value("Category").parse::<TilCategory>().unwrap_or(TilCategory::Technical);
        let tag_names = crate::cli::parse_comma_tags(form.value("Tags"));
        match TilRepository::update(db, edit_id, UpdateTil {
            title: Some(title), body: Some(body), source: Some(form.value_opt("Source").map(|s| s.to_string())), category: Some(category),
        }) {
            Ok(_) => {
                let _ = TagRepository::set_tags_by_name(db, EntityType::Til, edit_id, &tag_names);
                self.status_msg = Some(format!("TIL #{edit_id} updated.")); self.mode = ViewMode::List; self.form = None; self.edit_id = None; self.reload(db);
            }
            Err(e) => self.status_msg = Some(format!("Error: {e}")),
        }
    }
}

impl View for TilView {
    fn draw(&mut self, frame: &mut Frame, area: Rect, _db: &Database) {
        match self.mode {
            ViewMode::List => {
                let v = Layout::vertical([Constraint::Min(0), Constraint::Length(1), Constraint::Length(1)]).split(area);
                self.list.draw_or_empty(frame, v[0], "No TILs. Press 'a' to add.", render_til_item);
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
            ViewMode::Detail => { if let Some(til) = self.list.selected() { draw_detail(frame, area, til); } }
            ViewMode::Add | ViewMode::Edit => { if let Some(form) = &self.form { form.draw(frame, area); } }
            _ => {}
        }
    }
    fn handle_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction {
        if !self.loaded { self.reload(db); self.loaded = true; }
        match self.mode {
            ViewMode::List => {
                if self.list.is_searching() {
                    use crate::tui::widgets::list::SearchAction;
                    match self.list.handle_search_key(key, |t| format!("{} {} {}", t.title, t.category, t.tags.join(" "))) {
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
                        if let Some(t) = self.list.selected() { self.edit_id = Some(t.id); self.form = Some(Self::build_edit_form(t)); self.mode = ViewMode::Edit; }
                        ViewAction::Nothing
                    }
                    KeyCode::Delete => {
                        if let Some(t) = self.list.selected() { let id = t.id;
                            match TilRepository::soft_delete(db, id) {
                                Ok(()) => { self.status_msg = Some(format!("TIL #{id} deleted.")); self.reload(db); }
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
                        if let Some(t) = self.list.selected() { let id = t.id;
                            match TilRepository::restore(db, id) {
                                Ok(()) => { self.status_msg = Some(format!("TIL #{id} restored.")); self.reload(db); }
                                Err(e) => self.status_msg = Some(format!("Error: {e}")),
                            }
                        } ViewAction::Nothing
                    }
                    _ => ViewAction::Nothing,
                }
            }
            ViewMode::Detail => match key.code { KeyCode::Esc | KeyCode::Char('q') => { self.mode = ViewMode::List; ViewAction::Nothing } _ => ViewAction::Nothing },
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
            _ => ViewAction::Nothing,
        }
    }
}

fn render_til_item(til: &Til, _selected: bool) -> ListItem<'static> {
    ListItem::new(Line::from(vec![
        Span::styled(format!(" #{:<4}", til.id), Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{:10} ", til.category.to_string()), Style::default().fg(Color::Blue)),
        Span::raw(til.title.clone()),
    ]))
}

fn draw_detail(frame: &mut Frame, area: Rect, til: &Til) {
    let block = Block::default().borders(Borders::ALL).title(format!(" TIL #{} ", til.id));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let mut lines = vec![
        Line::from(vec![Span::styled("  Title: ", Style::default().add_modifier(Modifier::BOLD)), Span::raw(til.title.clone())]),
        Line::from(vec![Span::styled("  Category: ", Style::default().add_modifier(Modifier::BOLD)), Span::raw(til.category.to_string())]),
        Line::from(""),
        Line::from(format!("  {}", til.body)),
    ];
    if let Some(src) = &til.source { lines.push(Line::from("")); lines.push(Line::from(format!("  Source: {src}"))); }
    if !til.tags.is_empty() { lines.push(Line::from(format!("  Tags: {}", til.tags.join(", ")))); }
    lines.push(Line::from("")); lines.push(Line::from(Span::styled("  Press Esc to go back", Style::default().fg(Color::DarkGray))));
    frame.render_widget(Paragraph::new(lines), inner);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crossterm::event::KeyModifiers;

    fn test_db() -> Database { Database::open_in_memory().unwrap() }
    fn key(code: KeyCode) -> KeyEvent { KeyEvent::new(code, KeyModifiers::NONE) }

    #[test]
    fn q_pops() { let db = test_db(); let mut v = TilView::new(); assert!(matches!(v.handle_key(key(KeyCode::Char('q')), &db), ViewAction::Pop)); }

    #[test]
    fn a_opens_add() { let db = test_db(); let mut v = TilView::new(); v.handle_key(key(KeyCode::Char('a')), &db); assert!(matches!(v.mode, ViewMode::Add)); }

    #[test]
    fn render_seeded() {
        let db = test_db();
        TilRepository::create(&db, CreateTil { title: "Lifetimes".to_string(), body: "About refs".to_string(), source: None, category: TilCategory::Technical }).unwrap();
        let mut v = TilView::new(); v.reload(&db);
        let backend = ratatui::backend::TestBackend::new(100, 20);
        let mut terminal = ratatui::Terminal::new(backend).unwrap();
        terminal.draw(|f| v.draw(f, f.area(), &db)).unwrap();
        let buf = terminal.backend().buffer().clone();
        let mut out = String::new();
        for y in 0..buf.area.height { for x in 0..buf.area.width { out.push_str(buf[(x, y)].symbol()); } }
        assert!(out.contains("Lifetimes"));
    }
}
