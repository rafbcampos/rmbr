pub mod retro;
pub mod review;
pub mod standup;

use chrono::{Duration, NaiveDate, Utc};

use crate::db::todo::{duration_from_entries, TodoRepository};
use crate::db::Database;
use crate::models::todo::TimeAction;

/// Formats a duration as "Xh XXm". Returns empty string if zero or no entries.
pub fn format_duration(d: &Duration) -> String {
    if d.num_minutes() <= 0 {
        return String::new();
    }
    format!("{}h{:02}m", d.num_hours(), d.num_minutes() % 60)
}

/// Fetches time entries for a todo and returns formatted duration string.
/// Returns empty string if no time tracked.
pub fn format_todo_duration(db: &Database, todo_id: i64) -> String {
    TodoRepository::get_time_entries(db, todo_id)
        .ok()
        .map(|entries| duration_from_entries(&entries, Utc::now()))
        .filter(|d| d.num_minutes() > 0)
        .map(|d| format!(" ({})", format_duration(&d)))
        .unwrap_or_default()
}

/// Fetches time entries for a todo and returns duration in minutes, or None.
pub fn todo_duration_minutes(db: &Database, todo_id: i64) -> Option<i64> {
    TodoRepository::get_time_entries(db, todo_id)
        .ok()
        .map(|entries| duration_from_entries(&entries, Utc::now()))
        .filter(|d| d.num_minutes() > 0)
        .map(|d| d.num_minutes())
}

/// Checks if a todo was marked Done on or after the given date,
/// using the Done time entry timestamp (not updated_at).
pub fn was_done_since(db: &Database, todo_id: i64, since: NaiveDate) -> bool {
    TodoRepository::get_time_entries(db, todo_id)
        .ok()
        .map(|entries| {
            entries.iter().any(|e| e.action == TimeAction::Done && e.timestamp.date_naive() >= since)
        })
        .unwrap_or(false)
}

/// Formats tags as markdown inline code.
pub fn format_tags_markdown(tags: &[String]) -> String {
    if tags.is_empty() {
        String::new()
    } else {
        format!(" `{}`", tags.join("` `"))
    }
}
