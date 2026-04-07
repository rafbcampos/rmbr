use clap::Subcommand;

use super::{apply_tags, format_deleted, format_tags, parse_date, parse_date_opt, print_list};
use crate::db::goal::{CreateGoal, GoalFilter, GoalRepository, UpdateGoal};
use crate::db::repository::CrudRepository;
use crate::db::tag::EntityType;
use crate::db::{Database, DatabaseError};
use crate::models::goal::{Goal, GoalStatus};

#[derive(Subcommand)]
pub enum GoalAction {
    /// List goals
    List {
        #[arg(long)]
        status: Option<GoalStatus>,
        #[arg(long)]
        due_before: Option<String>,
        #[arg(long)]
        due_after: Option<String>,
        #[arg(long)]
        tag: Option<String>,
        #[arg(long)]
        deleted: bool,
    },
    /// Add a new goal
    Add {
        title: String,
        #[arg(long)]
        situation: Option<String>,
        #[arg(long)]
        task: Option<String>,
        #[arg(long)]
        action: Option<String>,
        #[arg(long)]
        result: Option<String>,
        #[arg(long)]
        due: Option<String>,
        #[arg(long)]
        tag: Vec<String>,
    },
    /// Edit an existing goal
    Edit {
        id: i64,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        situation: Option<String>,
        #[arg(long)]
        task: Option<String>,
        #[arg(long)]
        action: Option<String>,
        #[arg(long)]
        result: Option<String>,
        #[arg(long)]
        status: Option<GoalStatus>,
        #[arg(long)]
        due: Option<String>,
        /// Tags (replaces existing, repeatable)
        #[arg(long)]
        tag: Vec<String>,
    },
    /// Show goal details with STAR fields and linked todos
    Show { id: i64 },
    /// Link a todo to this goal
    Link { id: i64, #[arg(long)] todo: i64 },
    /// Unlink a todo from this goal
    Unlink { id: i64, #[arg(long)] todo: i64 },
    /// Soft-delete a goal
    Delete { id: i64 },
    /// Restore a soft-deleted goal
    Restore { id: i64 },
    /// Permanently remove a goal (by ID, or --all for bulk purge)
    Purge {
        id: Option<i64>,
        #[arg(long)]
        all: bool,
        #[arg(long)]
        older_than: Option<String>,
    },
}

pub fn handle(action: GoalAction, db: &Database) -> Result<(), DatabaseError> {
    match action {
        GoalAction::Add { title, situation, task, action, result, due, tag } => {
            let title = super::require(&title, "title")?;
            let due_date = parse_date_opt(&due)?;
            let goal = GoalRepository::create(db, CreateGoal {
                title, situation, task, action, result, due_date,
            })?;
            apply_tags(db, EntityType::Goal, goal.id, &tag)?;
            let goal = GoalRepository::get_by_id(db, goal.id)?
                .ok_or(DatabaseError::NotFound { entity: "goal", id: goal.id })?;
            print_goal(&goal);
            println!("Goal #{} created.", goal.id);
            Ok(())
        }
        GoalAction::List { status, due_before, due_after, tag, deleted } => {
            let filter = GoalFilter {
                status,
                due_before: parse_date_opt(&due_before)?,
                due_after: parse_date_opt(&due_after)?,
                tag,
                include_deleted: deleted,
            };
            let goals = GoalRepository::list(db, filter)?;
            print_list(&goals, "goal", print_goal_row);
            Ok(())
        }
        GoalAction::Show { id } => {
            let goal = GoalRepository::get_by_id(db, id)?
                .ok_or(DatabaseError::NotFound { entity: "goal", id })?;
            print_goal(&goal);
            let todos = GoalRepository::get_linked_todos(db, id)?;
            if !todos.is_empty() {
                println!("\nLinked todos:");
                for todo in &todos {
                    println!("  #{} [{}] {}", todo.id, todo.status, todo.title);
                }
            }
            Ok(())
        }
        GoalAction::Edit { id, title, situation, task, action, result, status, due, tag } => {
            let due_date = due.as_deref().map(parse_date).transpose()?;
            GoalRepository::update(db, id, UpdateGoal {
                title,
                situation: situation.map(Some),
                task: task.map(Some),
                action: action.map(Some),
                result: result.map(Some),
                status,
                due_date: due_date.map(Some),
            })?;
            if !tag.is_empty() {
                apply_tags(db, EntityType::Goal, id, &tag)?;
            }
            let goal = GoalRepository::get_by_id(db, id)?
                .ok_or(DatabaseError::NotFound { entity: "goal", id })?;
            print_goal(&goal);
            println!("Goal #{id} updated.");
            Ok(())
        }
        GoalAction::Link { id, todo } => {
            GoalRepository::link_todo(db, id, todo)?;
            println!("Todo #{todo} linked to Goal #{id}.");
            Ok(())
        }
        GoalAction::Unlink { id, todo } => {
            GoalRepository::unlink_todo(db, id, todo)?;
            println!("Todo #{todo} unlinked from Goal #{id}.");
            Ok(())
        }
        GoalAction::Delete { id } => super::soft_delete::<GoalRepository>(db, id, "Goal"),
        GoalAction::Restore { id } => super::restore::<GoalRepository>(db, id, "Goal"),
        GoalAction::Purge { id, all, older_than } => super::handle_purge::<GoalRepository>(db, id, all, &older_than, "goals", "Goal"),
    }
}

fn print_goal(goal: &Goal) {
    println!("#{} {}", goal.id, goal.title);
    println!("  Status: {} | STAR: {}/4", goal.status, goal.star_completeness());
    if let Some(ref s) = goal.situation { println!("  Situation: {s}"); }
    if let Some(ref t) = goal.task { println!("  Task: {t}"); }
    if let Some(ref a) = goal.action { println!("  Action: {a}"); }
    if let Some(ref r) = goal.result { println!("  Result: {r}"); }
    if let Some(due) = goal.due_date { println!("  Due: {due}"); }
    if !goal.tags.is_empty() { println!("  Tags: {}", goal.tags.join(", ")); }
    if goal.deleted_at.is_some() { println!("  [DELETED]"); }
}

fn print_goal_row(goal: &Goal) {
    let due = goal.due_date.map_or(String::new(), |d| format!(" due:{d}"));
    println!(
        "  #{:<4} {:12} STAR:{}/4 {}{}{}{}",
        goal.id, goal.status, goal.star_completeness(), goal.title,
        due, format_tags(&goal.tags), format_deleted(&goal.deleted_at),
    );
}
