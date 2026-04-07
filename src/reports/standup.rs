use chrono::{Datelike, Local, NaiveDate, Weekday};

use super::{format_tags_markdown, format_todo_duration, was_done_since};
use crate::db::config::ConfigRepository;
use crate::db::repository::CrudRepository;
use crate::db::todo::{TodoFilter, TodoRepository};
use crate::db::{Database, DatabaseError};
use crate::models::todo::TodoStatus;

/// Generates a standup report as markdown.
pub fn generate(db: &Database, since_override: Option<NaiveDate>) -> Result<String, DatabaseError> {
    let since = match since_override {
        Some(d) => d,
        None => find_previous_standup_day(db)?,
    };

    let today = Local::now().date_naive();
    let mut out = String::new();

    out.push_str(&format!("# Standup — {today}\n\n"));
    out.push_str(&format!("_Since {since}_\n\n"));

    let all_todos = TodoRepository::list(db, TodoFilter::default())?;

    // Done since last standup — use the Done time entry timestamp, not updated_at.
    let done: Vec<_> = all_todos
        .iter()
        .filter(|t| {
            t.status == TodoStatus::Done && was_done_since(db, t.id, since)
        })
        .collect();

    out.push_str("## Done\n\n");
    if done.is_empty() {
        out.push_str("_Nothing completed._\n\n");
    } else {
        for todo in &done {
            let duration = format_todo_duration(db, todo.id);
            let tags = format_tags_markdown(&todo.tags);
            out.push_str(&format!("- [x] **#{}** {}{}{}\n", todo.id, todo.title, duration, tags));
        }
        out.push('\n');
    }

    // In progress.
    let in_progress: Vec<_> = all_todos
        .iter()
        .filter(|t| t.status == TodoStatus::InProgress)
        .collect();

    out.push_str("## In Progress\n\n");
    if in_progress.is_empty() {
        out.push_str("_Nothing in progress._\n\n");
    } else {
        for todo in &in_progress {
            let duration = format_todo_duration(db, todo.id);
            out.push_str(&format!("- [ ] **#{}** {}{}\n", todo.id, todo.title, duration));
        }
        out.push('\n');
    }

    // Up next (pending, sorted by priority desc).
    let mut pending: Vec<_> = all_todos
        .iter()
        .filter(|t| t.status == TodoStatus::Pending)
        .collect();
    pending.sort_by(|a, b| b.priority.cmp(&a.priority));

    out.push_str("## Up Next\n\n");
    if pending.is_empty() {
        out.push_str("_No pending todos._\n\n");
    } else {
        for todo in pending.iter().take(10) {
            let due = todo.due_date.map_or(String::new(), |d| format!(" (due: {d})"));
            out.push_str(&format!("- [ ] **#{}** {} [{}]{}\n", todo.id, todo.title, todo.priority, due));
        }
        out.push('\n');
    }

    Ok(out)
}

/// Determines the previous standup day based on `standup.days` config.
fn find_previous_standup_day(db: &Database) -> Result<NaiveDate, DatabaseError> {
    let days_config = ConfigRepository::get(db, "standup.days")?
        .map(|c| c.value)
        .unwrap_or_else(|| "mon,tue,wed,thu,fri".to_string());

    let standup_weekdays: Vec<Weekday> = days_config
        .split(',')
        .filter_map(|s| parse_weekday(s.trim()))
        .collect();

    let today = Local::now().date_naive();

    for days_back in 1..=7 {
        let candidate = today - chrono::Duration::days(days_back);
        if standup_weekdays.contains(&candidate.weekday()) {
            return Ok(candidate);
        }
    }

    Ok(today - chrono::Duration::days(1))
}

fn parse_weekday(s: &str) -> Option<Weekday> {
    match s.to_lowercase().as_str() {
        "mon" | "monday" => Some(Weekday::Mon),
        "tue" | "tuesday" => Some(Weekday::Tue),
        "wed" | "wednesday" => Some(Weekday::Wed),
        "thu" | "thursday" => Some(Weekday::Thu),
        "fri" | "friday" => Some(Weekday::Fri),
        "sat" | "saturday" => Some(Weekday::Sat),
        "sun" | "sunday" => Some(Weekday::Sun),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::config::ConfigRepository;
    use crate::db::todo::{CreateTodo, TodoRepository};
    use crate::models::todo::{Priority, TimeAction};

    fn test_db() -> Database { Database::open_in_memory().unwrap() }

    #[test]
    fn standup_empty_db() {
        let db = test_db();
        let report = generate(&db, Some(NaiveDate::from_ymd_opt(2026, 1, 1).unwrap())).unwrap();
        assert!(report.contains("# Standup"));
        assert!(report.contains("Nothing completed"));
        assert!(report.contains("Nothing in progress"));
        assert!(report.contains("No pending todos"));
    }

    #[test]
    fn standup_with_data() {
        let db = test_db();
        let todo = TodoRepository::create(&db, CreateTodo {
            title: "Fix bug".to_string(), description: None, priority: Priority::High, due_date: None,
        }).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Start).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Done).unwrap();

        TodoRepository::create(&db, CreateTodo {
            title: "Write docs".to_string(), description: None, priority: Priority::Medium, due_date: None,
        }).unwrap();

        let report = generate(&db, Some(NaiveDate::from_ymd_opt(2020, 1, 1).unwrap())).unwrap();
        assert!(report.contains("Fix bug"));
        assert!(report.contains("[x]"));
        assert!(report.contains("Write docs"));
        assert!(report.contains("Up Next"));
    }

    #[test]
    fn standup_respects_config() {
        let db = test_db();
        ConfigRepository::set(&db, "standup.days", "mon,wed,fri").unwrap();
        let report = generate(&db, None).unwrap();
        assert!(report.contains("# Standup"));
    }

    #[test]
    fn parse_weekday_variants() {
        assert_eq!(parse_weekday("mon"), Some(Weekday::Mon));
        assert_eq!(parse_weekday("Monday"), Some(Weekday::Mon));
        assert_eq!(parse_weekday("fri"), Some(Weekday::Fri));
        assert_eq!(parse_weekday("nope"), None);
    }
}
