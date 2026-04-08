use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

use crate::db::Database;

/// Creates an in-memory database for tests.
pub fn test_db() -> Database {
    Database::open_in_memory().unwrap()
}

/// Creates a `KeyEvent` with no modifiers for the given `KeyCode`.
pub fn key(code: KeyCode) -> KeyEvent {
    KeyEvent::new(code, KeyModifiers::NONE)
}
