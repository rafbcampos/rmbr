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
    /// Hint text shown when the value is empty (e.g. "YYYY-MM-DD").
    pub placeholder: String,
    /// Per-field validation error, shown inline in red.
    pub error: Option<String>,
}

impl FormField {
    pub fn text(label: &str, default: &str, required: bool, placeholder: &str) -> Self {
        Self {
            label: label.to_string(),
            value: default.to_string(),
            required,
            options: Vec::new(),
            placeholder: placeholder.to_string(),
            error: None,
        }
    }

    pub fn select(label: &str, options: Vec<String>, default: &str) -> Self {
        Self {
            label: label.to_string(),
            value: default.to_string(),
            required: true,
            options,
            placeholder: String::new(),
            error: None,
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
    /// User submitted the form (Enter on last field).
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

    /// Validates that a field is non-empty. Sets an inline error and returns None if empty.
    pub fn require_non_empty(&mut self, label: &str) -> Option<String> {
        let value = self.value(label).to_string();
        if value.is_empty() {
            self.set_field_error(label, format!("{label} is required."));
            None
        } else {
            Some(value)
        }
    }

    /// Sets a validation error on a specific field by label.
    pub fn set_field_error(&mut self, label: &str, msg: String) {
        if let Some(field) = self.fields.iter_mut().find(|f| f.label == label) {
            field.error = Some(msg);
        }
    }

    /// Clears all field errors.
    pub fn clear_errors(&mut self) {
        for field in &mut self.fields {
            field.error = None;
        }
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
                    field.error = None;
                    if field.is_select() {
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
                        field.error = None;
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

        // Each field: label + input + error, 3 lines height.
        let constraints: Vec<Constraint> = self
            .fields
            .iter()
            .map(|_| Constraint::Length(3))
            .chain(std::iter::once(Constraint::Length(2))) // submit hint
            .chain(std::iter::once(Constraint::Min(0)))    // spacer
            .collect();

        let field_areas = Layout::vertical(constraints).split(inner);

        for (i, field) in self.fields.iter().enumerate() {
            let is_focused = i == self.focused;
            let has_error = field.error.is_some();

            let label_color = if has_error { Color::Red } else if is_focused { Color::Cyan } else { Color::Gray };
            let mut label_style = Style::default().fg(label_color);
            if is_focused {
                label_style = label_style.add_modifier(Modifier::BOLD);
            }

            let required_marker = if field.required { "*" } else { "" };

            let value_line = if field.is_select() {
                Line::from(format!("    < {} >", field.value))
            } else if field.value.is_empty() && !field.placeholder.is_empty() {
                if is_focused {
                    Line::from(vec![
                        Span::raw("    "),
                        Span::styled(&field.placeholder, Style::default().fg(Color::DarkGray)),
                        Span::styled("▏", Style::default().fg(Color::Cyan)),
                    ])
                } else {
                    Line::from(Span::styled(
                        format!("    {}", field.placeholder),
                        Style::default().fg(Color::DarkGray),
                    ))
                }
            } else if is_focused {
                Line::from(format!("    {}▏", field.value))
            } else {
                Line::from(format!("    {}", field.value))
            };

            let error_line = if let Some(err) = &field.error {
                Line::from(Span::styled(
                    format!("    {err}"),
                    Style::default().fg(Color::Red),
                ))
            } else {
                Line::from("")
            };

            let lines = vec![
                Line::from(Span::styled(
                    format!("  {}{required_marker}: ", field.label),
                    label_style,
                )),
                value_line,
                error_line,
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
                FormField::text("Title", "", true, ""),
                FormField::text("Description", "", false, ""),
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

    #[test]
    fn require_non_empty_returns_value_or_sets_error() {
        let mut form = test_form();
        // Empty field returns None and sets error.
        assert!(form.require_non_empty("Title").is_none());
        assert_eq!(
            form.fields[0].error.as_deref(),
            Some("Title is required."),
        );

        // Non-empty field returns Some and no error.
        form.clear_errors();
        form.handle_key(KeyEvent::from(KeyCode::Char('H')));
        form.handle_key(KeyEvent::from(KeyCode::Char('i')));
        let result = form.require_non_empty("Title");
        assert_eq!(result.as_deref(), Some("Hi"));
        assert!(form.fields[0].error.is_none());
    }

    #[test]
    fn set_field_error_and_clear() {
        let mut form = test_form();
        form.set_field_error("Title", "Title is required.".into());
        assert_eq!(
            form.fields.iter().find(|f| f.label == "Title").unwrap().error.as_deref(),
            Some("Title is required."),
        );

        form.clear_errors();
        assert!(form.fields.iter().all(|f| f.error.is_none()));
    }

    #[test]
    fn typing_clears_field_error() {
        let mut form = test_form();
        form.set_field_error("Title", "Required.".into());
        form.handle_key(KeyEvent::from(KeyCode::Char('a')));
        assert!(form.fields[0].error.is_none());
    }

    #[test]
    fn backspace_clears_field_error() {
        let mut form = test_form();
        form.handle_key(KeyEvent::from(KeyCode::Char('x')));
        form.set_field_error("Title", "Bad input.".into());
        form.handle_key(KeyEvent::from(KeyCode::Backspace));
        assert!(form.fields[0].error.is_none());
    }

    #[test]
    fn placeholder_stored_on_text_field() {
        let field = FormField::text("Due date", "", false, "YYYY-MM-DD");
        assert_eq!(field.placeholder, "YYYY-MM-DD");
    }
}
