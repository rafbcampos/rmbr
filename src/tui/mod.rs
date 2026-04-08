pub mod views;
pub mod widgets;

#[cfg(test)]
pub mod testutil;

use std::io;
use std::time::{Duration, Instant};

use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::layout::Rect;
use ratatui::Frame;

use crate::db::Database;

/// Actions a view can request after handling a key event.
pub enum ViewAction {
    /// No navigation change.
    Nothing,
    /// Push a new view onto the stack.
    Push(Box<dyn View>),
    /// Pop the current view (go back).
    Pop,
    /// Quit the application.
    Quit,
}

/// Trait for all TUI views (dashboard, entity lists, detail views, forms).
pub trait View {
    /// Render the view into the given area.
    fn draw(&mut self, frame: &mut Frame, area: Rect, db: &Database);

    /// Handle a key event. Returns a `ViewAction` to control navigation.
    fn handle_key(&mut self, key: KeyEvent, db: &Database) -> ViewAction;
}

/// RAII guard that restores the terminal on drop — handles panics, early returns, and errors.
struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        ratatui::restore();
    }
}

/// Runs the TUI application with an initial view.
/// Uses ratatui's init/restore for terminal setup — no manual crossterm calls.
pub fn run(db: &Database, initial_view: Box<dyn View>) -> io::Result<()> {
    // Install panic hook that restores terminal before printing panic.
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        ratatui::restore();
        original_hook(panic_info);
    }));

    let mut terminal = ratatui::init();
    let _guard = TerminalGuard; // ensures restore on any exit path
    let mut view_stack: Vec<Box<dyn View>> = vec![initial_view];
    let tick_rate = Duration::from_millis(250);
    let mut last_tick = Instant::now();

    while let Some(view) = view_stack.last_mut() {
        terminal.draw(|frame| {
            let area = frame.area();
            view.draw(frame, area, db);
        })?;

        let timeout = tick_rate.saturating_sub(last_tick.elapsed());
        if event::poll(timeout)?
            && let Event::Key(key) = event::read()?
        {
            if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
                break;
            }

            if let Some(view) = view_stack.last_mut() {
                match view.handle_key(key, db) {
                    ViewAction::Nothing => {}
                    ViewAction::Push(new_view) => view_stack.push(new_view),
                    ViewAction::Pop => {
                        view_stack.pop();
                        if view_stack.is_empty() {
                            break;
                        }
                    }
                    ViewAction::Quit => break,
                }
            }
        }

        if last_tick.elapsed() >= tick_rate {
            last_tick = Instant::now();
        }
    }

    // _guard's Drop calls ratatui::restore() automatically.
    Ok(())
}

/// Shared mode enum for entity views.
pub enum ViewMode {
    List,
    Detail,
    Add,
    Edit,
    /// Picking an entity to link (e.g., select a goal for a todo).
    LinkPicker,
}
