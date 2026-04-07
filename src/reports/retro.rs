use chrono::{Local, NaiveDate};

use super::{format_duration, format_tags_markdown, todo_duration_minutes, was_done_since};
use crate::db::config::ConfigRepository;
use crate::db::goal::{GoalFilter, GoalRepository};
use crate::db::kudo::{KudoFilter, KudoRepository};
use crate::db::repository::CrudRepository;
use crate::db::til::{TilFilter, TilRepository};
use crate::db::todo::{TodoFilter, TodoRepository};
use crate::db::{Database, DatabaseError};
use crate::models::todo::TodoStatus;

/// Generates a retrospective report as markdown.
pub fn generate(
    db: &Database,
    since: Option<NaiveDate>,
    last: Option<&str>,
) -> Result<String, DatabaseError> {
    let since_date = resolve_since(db, since, last)?;
    let today = Local::now().date_naive();
    let mut out = String::new();

    out.push_str(&format!("# Retrospective — {since_date} to {today}\n\n"));

    // Completed todos — use Done time entry timestamp.
    let all_todos = TodoRepository::list(db, TodoFilter::default())?;
    let done: Vec<_> = all_todos
        .iter()
        .filter(|t| {
            t.status == TodoStatus::Done && was_done_since(db, t.id, since_date)
        })
        .collect();

    out.push_str("## Completed Work\n\n");
    if done.is_empty() {
        out.push_str("_No todos completed in this period._\n\n");
    } else {
        let mut total_minutes: i64 = 0;
        for todo in &done {
            let mins = todo_duration_minutes(db, todo.id);
            let time_str = mins
                .map(|m| {
                    total_minutes += m;
                    let d = chrono::Duration::minutes(m);
                    format!(" — {}", format_duration(&d))
                })
                .unwrap_or_default();
            let tags = format_tags_markdown(&todo.tags);
            out.push_str(&format!("- **#{}** {}{}{}\n", todo.id, todo.title, time_str, tags));
        }
        let total = chrono::Duration::minutes(total_minutes);
        out.push_str(&format!(
            "\n**Total: {} items, {} tracked**\n\n",
            done.len(),
            format_duration(&total)
        ));
    }

    // Kudos.
    let kudos = KudoRepository::list(db, KudoFilter {
        date_after: Some(since_date),
        ..Default::default()
    })?;

    out.push_str("## Kudos\n\n");
    if kudos.is_empty() {
        out.push_str("_No kudos in this period._\n\n");
    } else {
        for kudo in &kudos {
            let from = kudo.from_name.as_deref().unwrap_or("?");
            let to = kudo.to_name.as_deref().unwrap_or("me");
            out.push_str(&format!("- **{}** — {} → {} ({})\n", kudo.title, from, to, kudo.date));
        }
        out.push('\n');
    }

    // TILs.
    let tils = TilRepository::list(db, TilFilter {
        date_after: Some(since_date),
        ..Default::default()
    })?;

    out.push_str("## Learnings (TIL)\n\n");
    if tils.is_empty() {
        out.push_str("_No TILs in this period._\n\n");
    } else {
        for til in &tils {
            out.push_str(&format!("- **{}** [{}]\n", til.title, til.category));
        }
        out.push('\n');
    }

    // Goal progress.
    let goals = GoalRepository::list(db, GoalFilter::default())?;
    out.push_str("## Goal Progress\n\n");
    if goals.is_empty() {
        out.push_str("_No goals._\n\n");
    } else {
        for goal in &goals {
            let linked = GoalRepository::get_linked_todos(db, goal.id).unwrap_or_default();
            let total = linked.len();
            let completed = linked.iter().filter(|t| t.status == TodoStatus::Done).count();
            let pct = if total > 0 { completed * 100 / total } else { 0 };
            out.push_str(&format!(
                "- **#{}** {} — STAR:{}/4, {completed}/{total} todos done ({pct}%)\n",
                goal.id, goal.title, goal.star_completeness()
            ));
        }
        out.push('\n');
    }

    Ok(out)
}

fn resolve_since(db: &Database, since: Option<NaiveDate>, last: Option<&str>) -> Result<NaiveDate, DatabaseError> {
    if let Some(d) = since { return Ok(d); }
    if let Some(last_str) = last { return parse_duration_back(last_str); }
    let weeks = ConfigRepository::get(db, "retro.period_weeks")?
        .and_then(|c| c.value.parse::<i64>().ok())
        .unwrap_or(2);
    Ok(Local::now().date_naive() - chrono::Duration::weeks(weeks))
}

fn parse_duration_back(s: &str) -> Result<NaiveDate, DatabaseError> {
    let today = Local::now().date_naive();
    let s = s.trim().to_lowercase();

    if let Some(num_str) = s.strip_suffix('w') {
        let weeks: i64 = num_str.parse().map_err(|_| DatabaseError::InvalidInput {
            message: format!("invalid duration '{s}', expected e.g. '2w' or '1m'"),
        })?;
        return Ok(today - chrono::Duration::weeks(weeks));
    }
    if let Some(num_str) = s.strip_suffix('m') {
        let months: i64 = num_str.parse().map_err(|_| DatabaseError::InvalidInput {
            message: format!("invalid duration '{s}', expected e.g. '2w' or '1m'"),
        })?;
        return Ok(today - chrono::Duration::days(months * 30));
    }

    Err(DatabaseError::InvalidInput {
        message: format!("invalid duration '{s}', expected e.g. '2w' or '1m'"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::todo::{CreateTodo, TodoRepository};
    use crate::models::todo::{Priority, TimeAction};

    fn test_db() -> Database { Database::open_in_memory().unwrap() }

    #[test]
    fn retro_empty_db() {
        let db = test_db();
        let report = generate(&db, Some(NaiveDate::from_ymd_opt(2020, 1, 1).unwrap()), None).unwrap();
        assert!(report.contains("# Retrospective"));
        assert!(report.contains("No todos completed"));
    }

    #[test]
    fn retro_with_completed_todo() {
        let db = test_db();
        let todo = TodoRepository::create(&db, CreateTodo {
            title: "Ship feature".to_string(), description: None, priority: Priority::High, due_date: None,
        }).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Start).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Done).unwrap();

        let report = generate(&db, Some(NaiveDate::from_ymd_opt(2020, 1, 1).unwrap()), None).unwrap();
        assert!(report.contains("Ship feature"));
        assert!(report.contains("Completed Work"));
    }

    #[test]
    fn parse_duration_2w() {
        let d = parse_duration_back("2w").unwrap();
        let expected = Local::now().date_naive() - chrono::Duration::weeks(2);
        assert_eq!(d, expected);
    }

    #[test]
    fn parse_duration_1m() {
        let d = parse_duration_back("1m").unwrap();
        let expected = Local::now().date_naive() - chrono::Duration::days(30);
        assert_eq!(d, expected);
    }

    #[test]
    fn parse_duration_invalid() { assert!(parse_duration_back("xyz").is_err()); }
}
