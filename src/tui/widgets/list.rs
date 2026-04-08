use crossterm::event::{KeyCode, KeyEvent};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, List, ListItem, ListState, Paragraph};
use ratatui::Frame;

/// Result of search-mode key handling.
pub enum SearchAction {
    /// Key consumed, stay in search mode.
    Consumed,
    /// Search cancelled or cleared (Esc / empty Backspace).
    Exit,
    /// Enter pressed — search stopped, selection kept.
    ExitWithSelection,
}

/// A generic scrollable list with selection and fuzzy search support.
///
/// `T` is the item type. The caller provides a rendering function
/// that converts each `&T` into a styled `ListItem`.
pub struct SelectableList<T> {
    items: Vec<T>,
    state: ListState,
    title: String,
    search_query: String,
    searching: bool,
    filtered_indices: Vec<usize>,
}

impl<T> SelectableList<T> {
    pub fn new(title: &str) -> Self {
        Self {
            items: Vec::new(),
            state: ListState::default(),
            title: title.to_string(),
            search_query: String::new(),
            searching: false,
            filtered_indices: Vec::new(),
        }
    }

    pub fn is_searching(&self) -> bool {
        self.searching
    }

    /// Starts search mode.
    pub fn start_search(&mut self) {
        self.searching = true;
        self.search_query.clear();
        self.filtered_indices = (0..self.items.len()).collect();
    }

    /// Stops search mode and resets the filter, preserving the selected item.
    pub fn stop_search(&mut self) {
        // Map filtered selection back to the real item index before clearing.
        let real_index = self.state.selected()
            .and_then(|vis| self.filtered_indices.get(vis).copied());
        self.searching = false;
        self.search_query.clear();
        self.filtered_indices.clear();

        let fallback = if self.items.is_empty() { None } else { Some(0) };
        self.state.select(real_index.or(fallback));
    }

    /// Updates the search query and refilters. `text_fn` extracts searchable text from each item.
    pub fn update_search(&mut self, query: &str, text_fn: impl Fn(&T) -> String) {
        self.search_query = query.to_string();
        self.filtered_indices = super::search::fuzzy_filter(&self.items, query, text_fn);
        // Reset selection within filtered results.
        if self.filtered_indices.is_empty() {
            self.state.select(None);
        } else {
            self.state.select(Some(0));
        }
    }

    /// Returns the visible items (filtered if searching, all if not).
    fn visible_count(&self) -> usize {
        if self.searching {
            self.filtered_indices.len()
        } else {
            self.items.len()
        }
    }

    /// Maps a visible index to an item index.
    fn visible_to_item(&self, visible_idx: usize) -> Option<usize> {
        if self.searching {
            self.filtered_indices.get(visible_idx).copied()
        } else {
            Some(visible_idx)
        }
    }

    /// Replaces the item list and preserves selection if possible.
    pub fn set_items(&mut self, items: Vec<T>) {
        let prev_selected = self.state.selected();
        self.items = items;

        if self.items.is_empty() {
            self.state.select(None);
        } else {
            // Clamp selection to new bounds.
            let idx = prev_selected.unwrap_or(0).min(self.items.len() - 1);
            self.state.select(Some(idx));
        }
    }

    pub fn items(&self) -> &[T] {
        &self.items
    }

    /// Returns a reference to the currently selected item, if any.
    /// When searching, maps through filtered indices.
    pub fn selected(&self) -> Option<&T> {
        let visible_idx = self.state.selected()?;
        let item_idx = self.visible_to_item(visible_idx)?;
        self.items.get(item_idx)
    }

    /// Returns the index of the currently selected item.
    #[cfg(test)]
    pub fn selected_index(&self) -> Option<usize> {
        self.state.selected()
    }

    pub fn select_next(&mut self) {
        let count = self.visible_count();
        if count == 0 { return; }
        let i = match self.state.selected() {
            Some(i) => (i + 1).min(count - 1),
            None => 0,
        };
        self.state.select(Some(i));
    }

    pub fn select_prev(&mut self) {
        if self.visible_count() == 0 { return; }
        let i = match self.state.selected() {
            Some(i) => i.saturating_sub(1),
            None => 0,
        };
        self.state.select(Some(i));
    }

    pub fn select_first(&mut self) {
        if self.visible_count() > 0 {
            self.state.select(Some(0));
        }
    }

    pub fn select_last(&mut self) {
        let count = self.visible_count();
        if count > 0 {
            self.state.select(Some(count - 1));
        }
    }

    /// Handles search-mode keypresses. Call this when `is_searching()` is true.
    /// The `text_fn` extracts searchable text from each item for fuzzy matching.
    pub fn handle_search_key(
        &mut self,
        key: KeyEvent,
        text_fn: impl Fn(&T) -> String,
    ) -> SearchAction {
        match key.code {
            KeyCode::Esc => {
                self.stop_search();
                SearchAction::Exit
            }
            KeyCode::Enter => {
                self.stop_search();
                SearchAction::ExitWithSelection
            }
            KeyCode::Down | KeyCode::Up => {
                self.handle_key(key);
                SearchAction::Consumed
            }
            KeyCode::Char(c) => {
                self.search_query.push(c);
                let q = self.search_query.clone();
                self.update_search(&q, text_fn);
                SearchAction::Consumed
            }
            KeyCode::Backspace => {
                self.search_query.pop();
                if self.search_query.is_empty() {
                    self.stop_search();
                    SearchAction::Exit
                } else {
                    let q = self.search_query.clone();
                    self.update_search(&q, text_fn);
                    SearchAction::Consumed
                }
            }
            _ => SearchAction::Consumed,
        }
    }

    /// Handles common list navigation keys. Returns `true` if the key was consumed.
    pub fn handle_key(&mut self, key: KeyEvent) -> bool {
        match key.code {
            KeyCode::Down | KeyCode::Char('j') => {
                self.select_next();
                true
            }
            KeyCode::Up | KeyCode::Char('k') => {
                self.select_prev();
                true
            }
            KeyCode::Home | KeyCode::Char('g') => {
                self.select_first();
                true
            }
            KeyCode::End | KeyCode::Char('G') => {
                self.select_last();
                true
            }
            _ => false,
        }
    }

    /// Renders the list. `render_item` converts each `&T` into a `ListItem`.
    /// When searching, shows only filtered items and a search bar.
    pub fn draw(
        &mut self,
        frame: &mut Frame,
        area: Rect,
        render_item: impl Fn(&T, bool) -> ListItem<'static>,
    ) {
        if self.searching {
            // Split area: search bar on top, list below.
            let vertical = Layout::vertical([
                Constraint::Length(1),
                Constraint::Min(0),
            ]).split(area);

            // Search bar.
            let search_display = format!(" /{}", self.search_query);
            let search_bar = Paragraph::new(Line::from(vec![
                Span::styled(search_display, Style::default().fg(Color::Yellow)),
                Span::styled("▏", Style::default().fg(Color::Yellow)),
            ]));
            frame.render_widget(search_bar, vertical[0]);

            // Filtered list.
            let visible_items: Vec<ListItem<'static>> = self
                .filtered_indices
                .iter()
                .enumerate()
                .map(|(visible_i, &item_i)| {
                    let selected = self.state.selected() == Some(visible_i);
                    render_item(&self.items[item_i], selected)
                })
                .collect();

            let count = self.filtered_indices.len();
            let total = self.items.len();
            let title = format!(" {} ({count}/{total}) ", self.title);

            let list = List::new(visible_items)
                .block(Block::default().borders(Borders::ALL).title(title))
                .highlight_style(
                    Style::default()
                        .bg(Color::DarkGray)
                        .add_modifier(Modifier::BOLD),
                );
            frame.render_stateful_widget(list, vertical[1], &mut self.state);
        } else {
            // Normal mode — show all items.
            let items: Vec<ListItem<'static>> = self
                .items
                .iter()
                .enumerate()
                .map(|(i, item)| {
                    let selected = self.state.selected() == Some(i);
                    render_item(item, selected)
                })
                .collect();

            let count = self.items.len();
            let title = format!(" {} ({count}) ", self.title);

            let list = List::new(items)
                .block(Block::default().borders(Borders::ALL).title(title))
                .highlight_style(
                    Style::default()
                        .bg(Color::DarkGray)
                        .add_modifier(Modifier::BOLD),
                );

            frame.render_stateful_widget(list, area, &mut self.state);
        }
    }

    /// Renders an empty-state message when the list has no items.
    pub fn draw_or_empty(
        &mut self,
        frame: &mut Frame,
        area: Rect,
        empty_msg: &str,
        render_item: impl Fn(&T, bool) -> ListItem<'static>,
    ) {
        if self.items.is_empty() {
            let block = Block::default()
                .borders(Borders::ALL)
                .title(format!(" {} ", self.title));
            let paragraph = ratatui::widgets::Paragraph::new(Line::from(format!("  {empty_msg}")))
                .block(block)
                .style(Style::default().fg(Color::DarkGray));
            frame.render_widget(paragraph, area);
        } else {
            self.draw(frame, area, render_item);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_list_has_no_selection() {
        let list: SelectableList<String> = SelectableList::new("Test");
        assert!(list.selected().is_none());
        assert!(list.items().is_empty());
    }

    #[test]
    fn set_items_selects_first() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["a", "b", "c"]);
        assert_eq!(list.selected(), Some(&"a"));
        assert_eq!(list.selected_index(), Some(0));
    }

    #[test]
    fn navigate_down_and_up() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["a", "b", "c"]);

        list.select_next();
        assert_eq!(list.selected(), Some(&"b"));

        list.select_next();
        assert_eq!(list.selected(), Some(&"c"));

        // At end, stays at last.
        list.select_next();
        assert_eq!(list.selected(), Some(&"c"));

        list.select_prev();
        assert_eq!(list.selected(), Some(&"b"));

        list.select_prev();
        assert_eq!(list.selected(), Some(&"a"));

        // At start, stays at first.
        list.select_prev();
        assert_eq!(list.selected(), Some(&"a"));
    }

    #[test]
    fn home_and_end() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["a", "b", "c"]);

        list.select_last();
        assert_eq!(list.selected(), Some(&"c"));

        list.select_first();
        assert_eq!(list.selected(), Some(&"a"));
    }

    #[test]
    fn set_items_clamps_selection() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["a", "b", "c"]);
        list.select_last(); // index 2

        // Replace with shorter list — selection should clamp.
        list.set_items(vec!["x"]);
        assert_eq!(list.selected(), Some(&"x"));
        assert_eq!(list.selected_index(), Some(0));
    }

    #[test]
    fn set_empty_clears_selection() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["a"]);
        list.set_items(Vec::<&str>::new());
        assert!(list.selected().is_none());
    }

    #[test]
    fn handle_key_j_k() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["a", "b"]);

        let consumed = list.handle_key(KeyEvent::from(KeyCode::Char('j')));
        assert!(consumed);
        assert_eq!(list.selected(), Some(&"b"));

        let consumed = list.handle_key(KeyEvent::from(KeyCode::Char('k')));
        assert!(consumed);
        assert_eq!(list.selected(), Some(&"a"));
    }

    #[test]
    fn handle_key_unknown_not_consumed() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["a"]);

        let consumed = list.handle_key(KeyEvent::from(KeyCode::Char('z')));
        assert!(!consumed);
    }

    #[test]
    fn navigate_empty_list_is_safe() {
        let mut list: SelectableList<String> = SelectableList::new("Test");
        list.select_next();
        list.select_prev();
        list.select_first();
        list.select_last();
        assert!(list.selected().is_none());
    }

    #[test]
    fn stop_search_preserves_selected_item() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["alpha", "beta", "gamma"]);

        list.start_search();
        // Simulate a filter that only matches "gamma" (index 2).
        list.filtered_indices = vec![2];
        list.state.select(Some(0)); // visible index 0 → real index 2

        list.stop_search();
        // After stopping, the real item at index 2 should be selected.
        assert_eq!(list.selected(), Some(&"gamma"));
        assert_eq!(list.selected_index(), Some(2));
    }

    #[test]
    fn stop_search_falls_back_to_first_when_no_selection() {
        let mut list = SelectableList::new("Test");
        list.set_items(vec!["alpha", "beta"]);

        list.start_search();
        list.filtered_indices.clear();
        list.state.select(None);

        list.stop_search();
        assert_eq!(list.selected(), Some(&"alpha"));
    }
}
