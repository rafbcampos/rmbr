use std::collections::HashMap;

use chrono::{Datelike, Local, NaiveDate};

use super::format_todo_duration;
use crate::db::config::ConfigRepository;
use crate::db::goal::{GoalFilter, GoalRepository};
use crate::db::kudo::{KudoFilter, KudoRepository};
use crate::db::repository::CrudRepository;
use crate::db::til::{TilFilter, TilRepository};
use crate::db::{Database, DatabaseError};
use crate::models::todo::TodoStatus;

/// Generates a performance review report as markdown.
pub fn generate(
    db: &Database,
    half: Option<&str>,
    since: Option<NaiveDate>,
) -> Result<String, DatabaseError> {
    let (since_date, period_label) = resolve_period(db, half, since)?;
    let today = Local::now().date_naive();
    let mut out = String::new();

    out.push_str(&format!("# Performance Review — {period_label}\n\n"));
    out.push_str(&format!("_Period: {since_date} to {today}_\n\n"));

    // Pre-build a lookup: goal_id -> Vec<kudo> for efficient rendering.
    let all_kudos = KudoRepository::list(db, KudoFilter {
        date_after: Some(since_date),
        ..Default::default()
    })?;
    let mut goal_kudos: HashMap<i64, Vec<&crate::models::kudo::Kudo>> = HashMap::new();
    let mut standalone_kudos = Vec::new();
    for kudo in &all_kudos {
        let linked_goals = KudoRepository::get_linked_goals(db, kudo.id).unwrap_or_default();
        if linked_goals.is_empty() {
            standalone_kudos.push(kudo);
        } else {
            for goal in &linked_goals {
                goal_kudos.entry(goal.id).or_default().push(kudo);
            }
        }
    }

    // Goals with STAR + linked evidence.
    let goals = GoalRepository::list(db, GoalFilter::default())?;

    out.push_str("## Goals\n\n");
    if goals.is_empty() {
        out.push_str("_No goals defined._\n\n");
    } else {
        for goal in &goals {
            out.push_str(&format!("### #{} — {}\n\n", goal.id, goal.title));
            out.push_str(&format!("**Status:** {} | **STAR:** {}/4\n\n", goal.status, goal.star_completeness()));

            if let Some(ref s) = goal.situation { out.push_str(&format!("**Situation:** {s}\n\n")); }
            if let Some(ref t) = goal.task { out.push_str(&format!("**Task:** {t}\n\n")); }
            if let Some(ref a) = goal.action { out.push_str(&format!("**Action:** {a}\n\n")); }
            if let Some(ref r) = goal.result { out.push_str(&format!("**Result:** {r}\n\n")); }

            // Linked todos as evidence.
            let linked_todos = GoalRepository::get_linked_todos(db, goal.id).unwrap_or_default();
            if !linked_todos.is_empty() {
                out.push_str("**Evidence (linked todos):**\n\n");
                for todo in &linked_todos {
                    let status_mark = if todo.status == TodoStatus::Done { "x" } else { " " };
                    let duration = format_todo_duration(db, todo.id);
                    out.push_str(&format!("- [{status_mark}] #{} {}{}\n", todo.id, todo.title, duration));
                }
                let done_count = linked_todos.iter().filter(|t| t.status == TodoStatus::Done).count();
                out.push_str(&format!("\n_Progress: {done_count}/{} todos completed_\n\n", linked_todos.len()));
            }

            // Kudos linked to this goal (from pre-built lookup).
            if let Some(kudos) = goal_kudos.get(&goal.id) {
                out.push_str("**Validation (kudos):**\n\n");
                for kudo in kudos {
                    let from = kudo.from_name.as_deref().unwrap_or("?");
                    out.push_str(&format!("- ★ {} — from {} ({})\n", kudo.title, from, kudo.date));
                }
                out.push('\n');
            }

            out.push_str("---\n\n");
        }
    }

    // Standalone kudos.
    if !standalone_kudos.is_empty() {
        out.push_str("## Other Kudos\n\n");
        for kudo in &standalone_kudos {
            let from = kudo.from_name.as_deref().unwrap_or("?");
            let to = kudo.to_name.as_deref().unwrap_or("me");
            out.push_str(&format!("- **{}** — {} → {} ({})\n", kudo.title, from, to, kudo.date));
        }
        out.push('\n');
    }

    // TILs by category.
    let tils = TilRepository::list(db, TilFilter {
        date_after: Some(since_date),
        ..Default::default()
    })?;

    if !tils.is_empty() {
        out.push_str("## Growth & Learning\n\n");
        let categories = ["technical", "process", "domain", "people"];
        for cat in categories {
            let cat_tils: Vec<_> = tils.iter().filter(|t| t.category.to_string() == cat).collect();
            if !cat_tils.is_empty() {
                out.push_str(&format!("### {}\n\n", capitalize(cat)));
                for til in &cat_tils {
                    let src = til.source.as_deref().map(|s| format!(" — _{s}_")).unwrap_or_default();
                    out.push_str(&format!("- **{}**{}\n", til.title, src));
                }
                out.push('\n');
            }
        }
    }

    Ok(out)
}

fn resolve_period(db: &Database, half: Option<&str>, since: Option<NaiveDate>) -> Result<(NaiveDate, String), DatabaseError> {
    if let Some(d) = since {
        return Ok((d, format!("Since {d}")));
    }
    let today = Local::now().date_naive();
    let year = today.year();

    if let Some(h) = half {
        match h.to_uppercase().as_str() {
            "H1" => Ok((NaiveDate::from_ymd_opt(year, 1, 1).unwrap(), format!("{year} H1"))),
            "H2" => Ok((NaiveDate::from_ymd_opt(year, 7, 1).unwrap(), format!("{year} H2"))),
            _ => Err(DatabaseError::InvalidInput { message: format!("invalid half '{h}', expected H1 or H2") }),
        }
    } else {
        let months = ConfigRepository::get(db, "review.period_months")?
            .and_then(|c| c.value.parse::<i64>().ok())
            .unwrap_or(6);
        let days = months * 30;
        Ok((today - chrono::Duration::days(days), format!("Last {months} months")))
    }
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().to_string() + c.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::goal::{CreateGoal, GoalRepository};
    use crate::db::kudo::{CreateKudo, KudoRepository};
    use crate::db::til::{CreateTil, TilRepository};
    use crate::db::todo::{CreateTodo, TodoRepository};
    use crate::models::til::TilCategory;
    use crate::models::todo::{Priority, TimeAction};

    fn test_db() -> Database { Database::open_in_memory().unwrap() }

    #[test]
    fn review_empty_db() {
        let db = test_db();
        let report = generate(&db, None, Some(NaiveDate::from_ymd_opt(2020, 1, 1).unwrap())).unwrap();
        assert!(report.contains("# Performance Review"));
        assert!(report.contains("No goals defined"));
    }

    #[test]
    fn review_with_goal_and_evidence() {
        let db = test_db();
        let goal = GoalRepository::create(&db, CreateGoal {
            title: "Ship feature X".to_string(),
            situation: Some("Team needs X".to_string()),
            task: Some("Build it".to_string()),
            action: Some("Built in Rust".to_string()),
            result: Some("Shipped on time".to_string()),
            due_date: None,
        }).unwrap();
        let todo = TodoRepository::create(&db, CreateTodo {
            title: "Design API".to_string(), description: None, priority: Priority::High, due_date: None,
        }).unwrap();
        GoalRepository::link_todo(&db, goal.id, todo.id).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Start).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Done).unwrap();

        KudoRepository::create(&db, CreateKudo {
            title: "Great work".to_string(), description: None,
            from_name: Some("Alice".to_string()), from_slack: None, to_name: None, to_slack: None,
            date: Local::now().date_naive(),
        }).unwrap();
        KudoRepository::link_goal(&db, 1, goal.id).unwrap();

        TilRepository::create(&db, CreateTil {
            title: "Rust lifetimes".to_string(), body: "About refs".to_string(),
            source: Some("Rust Book".to_string()), category: TilCategory::Technical,
        }).unwrap();

        let report = generate(&db, None, Some(NaiveDate::from_ymd_opt(2020, 1, 1).unwrap())).unwrap();
        assert!(report.contains("Ship feature X"));
        assert!(report.contains("Situation:"));
        assert!(report.contains("Design API"));
        assert!(report.contains("Great work"));
        assert!(report.contains("Rust lifetimes"));
        assert!(report.contains("Growth & Learning"));
    }

    #[test]
    fn resolve_h1() {
        let db = test_db();
        let (date, label) = resolve_period(&db, Some("H1"), None).unwrap();
        assert_eq!(date.month(), 1);
        assert!(label.contains("H1"));
    }

    #[test]
    fn resolve_h2() {
        let db = test_db();
        let (date, label) = resolve_period(&db, Some("H2"), None).unwrap();
        assert_eq!(date.month(), 7);
        assert!(label.contains("H2"));
    }

    #[test]
    fn resolve_invalid_half() {
        let db = test_db();
        assert!(resolve_period(&db, Some("H3"), None).is_err());
    }

    #[test]
    fn resolve_uses_config_period() {
        let db = test_db();
        ConfigRepository::set(&db, "review.period_months", "3").unwrap();
        let (date, label) = resolve_period(&db, None, None).unwrap();
        let expected = Local::now().date_naive() - chrono::Duration::days(90);
        assert_eq!(date, expected);
        assert!(label.contains("3 months"));
    }
}
