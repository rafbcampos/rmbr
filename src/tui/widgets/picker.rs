use crossterm::event::{KeyCode, KeyEvent};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Clear, List, ListItem, ListState, Paragraph};
use ratatui::Frame;

/// A modal picker that displays a list of items for selection.
/// Used for linking entities (e.g., pick a goal to link to a todo).
pub struct Picker {
    title: String,
    items: Vec<PickerItem>,
    filtered: Vec<usize>,
    state: ListState,
    query: String,
}

pub struct PickerItem {
    pub id: i64,
    pub label: String,
}

/// Result of picker key handling.
pub enum PickerAction {
    /// Still browsing.
    Browsing,
    /// User selected an item.
    Selected(i64),
    /// User cancelled.
    Cancelled,
}

impl Picker {
    pub fn new(title: &str, items: Vec<PickerItem>) -> Self {
        let filtered: Vec<usize> = (0..items.len()).collect();
        let mut state = ListState::default();
        if !filtered.is_empty() {
            state.select(Some(0));
        }
        Self {
            title: title.to_string(),
            items,
            filtered,
            state,
            query: String::new(),
        }
    }

    /// Returns the currently selected item, if any.
    pub fn selected_item(&self) -> Option<&PickerItem> {
        let sel = self.state.selected()?;
        let &idx = self.filtered.get(sel)?;
        self.items.get(idx)
    }

    fn refilter(&mut self) {
        self.filtered = super::search::fuzzy_filter(&self.items, &self.query, |item| item.label.clone());

        if self.filtered.is_empty() {
            self.state.select(None);
        } else {
            self.state.select(Some(0));
        }
    }

    pub fn handle_key(&mut self, key: KeyEvent) -> PickerAction {
        match key.code {
            KeyCode::Esc => PickerAction::Cancelled,
            KeyCode::Enter => {
                if let Some(sel) = self.state.selected()
                    && let Some(&idx) = self.filtered.get(sel)
                {
                    return PickerAction::Selected(self.items[idx].id);
                }
                PickerAction::Browsing
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if !self.filtered.is_empty() {
                    let i = self.state.selected().map_or(0, |i| (i + 1).min(self.filtered.len() - 1));
                    self.state.select(Some(i));
                }
                PickerAction::Browsing
            }
            KeyCode::Up | KeyCode::Char('k') => {
                if !self.filtered.is_empty() {
                    let i = self.state.selected().map_or(0, |i| i.saturating_sub(1));
                    self.state.select(Some(i));
                }
                PickerAction::Browsing
            }
            KeyCode::Char(c) => {
                self.query.push(c);
                self.refilter();
                PickerAction::Browsing
            }
            KeyCode::Backspace => {
                self.query.pop();
                self.refilter();
                PickerAction::Browsing
            }
            _ => PickerAction::Browsing,
        }
    }

    /// Draws the picker as a centered popup over the given area.
    pub fn draw(&mut self, frame: &mut Frame, area: Rect) {
        let popup = centered_rect(60, 60, area);

        // Clear the area behind the popup.
        frame.render_widget(Clear, popup);

        let vertical = Layout::vertical([
            Constraint::Length(3), // search bar
            Constraint::Min(0),   // list
            Constraint::Length(1), // hint
        ])
        .split(popup);

        // Search bar.
        let search_text = if self.query.is_empty() {
            "Type to filter...".to_string()
        } else {
            format!("{}▏", self.query)
        };
        let search_style = if self.query.is_empty() {
            Style::default().fg(Color::DarkGray)
        } else {
            Style::default().fg(Color::White)
        };
        let search = Paragraph::new(Line::from(Span::styled(
            format!("  {search_text}"),
            search_style,
        )))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(format!(" {} ", self.title)),
        );
        frame.render_widget(search, vertical[0]);

        // List.
        let items: Vec<ListItem<'static>> = self
            .filtered
            .iter()
            .map(|&idx| {
                let item = &self.items[idx];
                ListItem::new(Line::from(format!("  #{} {}", item.id, item.label)))
            })
            .collect();

        let list = List::new(items)
            .block(Block::default().borders(Borders::LEFT | Borders::RIGHT))
            .highlight_style(
                Style::default()
                    .bg(Color::DarkGray)
                    .add_modifier(Modifier::BOLD),
            );
        frame.render_stateful_widget(list, vertical[1], &mut self.state);

        // Hint.
        let hint = Paragraph::new(Line::from(vec![
            Span::styled(" Enter", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
            Span::raw(":select  "),
            Span::styled("Esc", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
            Span::raw(":cancel"),
        ]))
        .block(Block::default().borders(Borders::LEFT | Borders::RIGHT | Borders::BOTTOM));
        frame.render_widget(hint, vertical[2]);
    }
}

/// Returns a centered Rect using percentages of the parent area.
fn centered_rect(percent_x: u16, percent_y: u16, area: Rect) -> Rect {
    let vertical = Layout::vertical([
        Constraint::Percentage((100 - percent_y) / 2),
        Constraint::Percentage(percent_y),
        Constraint::Percentage((100 - percent_y) / 2),
    ])
    .split(area);

    let horizontal = Layout::horizontal([
        Constraint::Percentage((100 - percent_x) / 2),
        Constraint::Percentage(percent_x),
        Constraint::Percentage((100 - percent_x) / 2),
    ])
    .split(vertical[1]);

    horizontal[1]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_picker() -> Picker {
        Picker::new(
            "Select Goal",
            vec![
                PickerItem { id: 1, label: "Ship feature X".to_string() },
                PickerItem { id: 2, label: "Improve performance".to_string() },
                PickerItem { id: 3, label: "Write documentation".to_string() },
            ],
        )
    }

    #[test]
    fn initial_state() {
        let picker = test_picker();
        assert_eq!(picker.filtered.len(), 3);
        assert_eq!(picker.state.selected(), Some(0));
    }

    #[test]
    fn enter_selects_first() {
        let mut picker = test_picker();
        let action = picker.handle_key(KeyEvent::from(KeyCode::Enter));
        assert!(matches!(action, PickerAction::Selected(1)));
    }

    #[test]
    fn navigate_and_select() {
        let mut picker = test_picker();
        picker.handle_key(KeyEvent::from(KeyCode::Down));
        let action = picker.handle_key(KeyEvent::from(KeyCode::Enter));
        assert!(matches!(action, PickerAction::Selected(2)));
    }

    #[test]
    fn esc_cancels() {
        let mut picker = test_picker();
        assert!(matches!(
            picker.handle_key(KeyEvent::from(KeyCode::Esc)),
            PickerAction::Cancelled
        ));
    }

    #[test]
    fn filter_narrows_list() {
        let mut picker = test_picker();
        picker.handle_key(KeyEvent::from(KeyCode::Char('d')));
        picker.handle_key(KeyEvent::from(KeyCode::Char('o')));
        picker.handle_key(KeyEvent::from(KeyCode::Char('c')));
        // Only "Write documentation" matches "doc".
        assert_eq!(picker.filtered.len(), 1);
        let action = picker.handle_key(KeyEvent::from(KeyCode::Enter));
        assert!(matches!(action, PickerAction::Selected(3)));
    }

    #[test]
    fn backspace_widens_filter() {
        let mut picker = test_picker();
        picker.handle_key(KeyEvent::from(KeyCode::Char('x')));
        assert_eq!(picker.filtered.len(), 1); // "Ship feature X"
        picker.handle_key(KeyEvent::from(KeyCode::Backspace));
        assert_eq!(picker.filtered.len(), 3); // all back
    }

    #[test]
    fn empty_filter_shows_all() {
        let picker = test_picker();
        assert_eq!(picker.filtered.len(), 3);
        assert!(picker.query.is_empty());
    }

    #[test]
    fn no_match_has_no_selection() {
        let mut picker = test_picker();
        picker.handle_key(KeyEvent::from(KeyCode::Char('z')));
        picker.handle_key(KeyEvent::from(KeyCode::Char('z')));
        picker.handle_key(KeyEvent::from(KeyCode::Char('z')));
        assert_eq!(picker.filtered.len(), 0);
        assert_eq!(picker.state.selected(), None);
        // Enter on empty does nothing.
        assert!(matches!(
            picker.handle_key(KeyEvent::from(KeyCode::Enter)),
            PickerAction::Browsing
        ));
    }
}
