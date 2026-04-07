use crossterm::event::{KeyCode, KeyEvent};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

/// A single field in a form.
pub struct FormField {
    pub label: String,
    pub value: String,
    pub required: bool,
    /// If set, the field cycles through these options instead of free text.
    pub options: Vec<String>,
}

impl FormField {
    pub fn text(label: &str, default: &str, required: bool) -> Self {
        Self {
            label: label.to_string(),
            value: default.to_string(),
            required,
            options: Vec::new(),
        }
    }

    pub fn select(label: &str, options: Vec<String>, default: &str) -> Self {
        Self {
            label: label.to_string(),
            value: default.to_string(),
            required: true,
            options,
        }
    }

    fn is_select(&self) -> bool {
        !self.options.is_empty()
    }

    fn cycle_option_forward(&mut self) {
        if let Some(idx) = self.options.iter().position(|o| o == &self.value) {
            let next = (idx + 1) % self.options.len();
            self.value = self.options[next].clone();
        } else if let Some(first) = self.options.first() {
            self.value = first.clone();
        }
    }

    fn cycle_option_backward(&mut self) {
        if let Some(idx) = self.options.iter().position(|o| o == &self.value) {
            let prev = if idx == 0 { self.options.len() - 1 } else { idx - 1 };
            self.value = self.options[prev].clone();
        } else if let Some(first) = self.options.first() {
            self.value = first.clone();
        }
    }
}

/// Result of form key handling.
pub enum FormAction {
    /// Form is still being edited.
    Editing,
    /// User submitted the form (Enter on last field or Ctrl+S).
    Submit,
    /// User cancelled (Esc).
    Cancel,
}

/// A multi-field form widget with Tab navigation.
pub struct Form {
    pub fields: Vec<FormField>,
    focused: usize,
    pub title: String,
}

impl Form {
    pub fn new(title: &str, fields: Vec<FormField>) -> Self {
        Self {
            fields,
            focused: 0,
            title: title.to_string(),
        }
    }

    /// Returns the value of a field by label, or empty string if not found.
    pub fn value(&self, label: &str) -> &str {
        self.fields
            .iter()
            .find(|f| f.label == label)
            .map(|f| f.value.as_str())
            .unwrap_or("")
    }

    /// Returns the value of a field as Option (None if empty).
    pub fn value_opt(&self, label: &str) -> Option<&str> {
        let v = self.value(label);
        if v.is_empty() { None } else { Some(v) }
    }

    /// Handles key events for the form. Returns a `FormAction`.
    pub fn handle_key(&mut self, key: KeyEvent) -> FormAction {
        match key.code {
            KeyCode::Esc => FormAction::Cancel,
            KeyCode::Tab | KeyCode::Down => {
                self.focused = (self.focused + 1) % self.fields.len();
                FormAction::Editing
            }
            KeyCode::BackTab | KeyCode::Up => {
                self.focused = if self.focused == 0 {
                    self.fields.len() - 1
                } else {
                    self.focused - 1
                };
                FormAction::Editing
            }
            KeyCode::Enter => {
                if self.focused == self.fields.len() - 1 {
                    FormAction::Submit
                } else {
                    // Move to next field.
                    self.focused = (self.focused + 1) % self.fields.len();
                    FormAction::Editing
                }
            }
            KeyCode::Char(c) => {
                if let Some(field) = self.fields.get_mut(self.focused) {
                    if field.is_select() {
                        // For select fields, Left/Right or typed chars cycle options.
                        field.cycle_option_forward();
                    } else {
                        field.value.push(c);
                    }
                }
                FormAction::Editing
            }
            KeyCode::Backspace => {
                if let Some(field) = self.fields.get_mut(self.focused)
                    && !field.is_select() {
                        field.value.pop();
                    }
                FormAction::Editing
            }
            KeyCode::Left => {
                if let Some(field) = self.fields.get_mut(self.focused)
                    && field.is_select() {
                        field.cycle_option_backward();
                    }
                FormAction::Editing
            }
            KeyCode::Right => {
                if let Some(field) = self.fields.get_mut(self.focused)
                    && field.is_select() {
                        field.cycle_option_forward();
                    }
                FormAction::Editing
            }
            _ => FormAction::Editing,
        }
    }

    pub fn draw(&self, frame: &mut Frame, area: Rect) {
        let block = Block::default()
            .borders(Borders::ALL)
            .title(format!(" {} ", self.title))
            .style(Style::default());

        let inner = block.inner(area);
        frame.render_widget(block, area);

        // Each field: label + input, 2 lines height.
        let constraints: Vec<Constraint> = self
            .fields
            .iter()
            .map(|_| Constraint::Length(2))
            .chain(std::iter::once(Constraint::Length(2))) // submit hint
            .chain(std::iter::once(Constraint::Min(0)))    // spacer
            .collect();

        let field_areas = Layout::vertical(constraints).split(inner);

        for (i, field) in self.fields.iter().enumerate() {
            let is_focused = i == self.focused;
            let label_style = if is_focused {
                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Gray)
            };

            let required_marker = if field.required { "*" } else { "" };

            let value_display = if field.is_select() {
                format!("< {} >", field.value)
            } else if is_focused {
                format!("{}▏", field.value)
            } else {
                field.value.clone()
            };

            let lines = vec![
                Line::from(Span::styled(
                    format!("  {}{required_marker}: ", field.label),
                    label_style,
                )),
                Line::from(format!("    {value_display}")),
            ];

            let paragraph = Paragraph::new(lines);
            frame.render_widget(paragraph, field_areas[i]);
        }

        // Submit hint at the bottom.
        let hint_idx = self.fields.len();
        if hint_idx < field_areas.len() {
            let hint = Paragraph::new(Line::from(vec![
                Span::styled("  Enter", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                Span::raw(": submit  "),
                Span::styled("Esc", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
                Span::raw(": cancel  "),
                Span::styled("Tab", Style::default().fg(Color::Yellow)),
                Span::raw(": next field"),
            ]));
            frame.render_widget(hint, field_areas[hint_idx]);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_form() -> Form {
        Form::new(
            "Test",
            vec![
                FormField::text("Title", "", true),
                FormField::text("Description", "", false),
                FormField::select(
                    "Priority",
                    vec!["low".to_string(), "medium".to_string(), "high".to_string()],
                    "medium",
                ),
            ],
        )
    }

    #[test]
    fn tab_cycles_fields() {
        let mut form = test_form();
        assert_eq!(form.focused, 0);

        form.handle_key(KeyEvent::from(KeyCode::Tab));
        assert_eq!(form.focused, 1);

        form.handle_key(KeyEvent::from(KeyCode::Tab));
        assert_eq!(form.focused, 2);

        form.handle_key(KeyEvent::from(KeyCode::Tab));
        assert_eq!(form.focused, 0); // wraps
    }

    #[test]
    fn backtab_cycles_backward() {
        let mut form = test_form();
        form.handle_key(KeyEvent::from(KeyCode::BackTab));
        assert_eq!(form.focused, 2); // wraps to last
    }

    #[test]
    fn typing_appends_to_text_field() {
        let mut form = test_form();
        form.handle_key(KeyEvent::from(KeyCode::Char('H')));
        form.handle_key(KeyEvent::from(KeyCode::Char('i')));
        assert_eq!(form.value("Title"), "Hi");
    }

    #[test]
    fn backspace_removes_char() {
        let mut form = test_form();
        form.handle_key(KeyEvent::from(KeyCode::Char('A')));
        form.handle_key(KeyEvent::from(KeyCode::Char('B')));
        form.handle_key(KeyEvent::from(KeyCode::Backspace));
        assert_eq!(form.value("Title"), "A");
    }

    #[test]
    fn select_field_cycles() {
        let mut form = test_form();
        // Move to Priority field.
        form.handle_key(KeyEvent::from(KeyCode::Tab));
        form.handle_key(KeyEvent::from(KeyCode::Tab));
        assert_eq!(form.value("Priority"), "medium");

        // Typing on a select field cycles forward.
        form.handle_key(KeyEvent::from(KeyCode::Char(' ')));
        assert_eq!(form.value("Priority"), "high");

        // Right arrow also cycles.
        form.handle_key(KeyEvent::from(KeyCode::Right));
        assert_eq!(form.value("Priority"), "low"); // wraps

        // Left arrow cycles backward.
        form.handle_key(KeyEvent::from(KeyCode::Left));
        assert_eq!(form.value("Priority"), "high");
    }

    #[test]
    fn esc_cancels() {
        let mut form = test_form();
        assert!(matches!(form.handle_key(KeyEvent::from(KeyCode::Esc)), FormAction::Cancel));
    }

    #[test]
    fn enter_on_last_field_submits() {
        let mut form = test_form();
        form.focused = 2; // last field
        assert!(matches!(form.handle_key(KeyEvent::from(KeyCode::Enter)), FormAction::Submit));
    }

    #[test]
    fn enter_on_middle_field_moves_next() {
        let mut form = test_form();
        form.focused = 0;
        assert!(matches!(form.handle_key(KeyEvent::from(KeyCode::Enter)), FormAction::Editing));
        assert_eq!(form.focused, 1);
    }

    #[test]
    fn value_opt_returns_none_for_empty() {
        let form = test_form();
        assert!(form.value_opt("Title").is_none());
        assert!(form.value_opt("Priority").is_some()); // has default "medium"
    }
}
