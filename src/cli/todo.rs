use chrono::Utc;
use clap::Subcommand;

use super::{apply_tags, format_deleted, format_tags, parse_date, parse_date_opt, print_list};
use crate::db::goal::GoalRepository;
use crate::db::repository::CrudRepository;
use crate::db::tag::EntityType;
use crate::db::todo::{CreateTodo, TodoFilter, TodoRepository, UpdateTodo};
use crate::db::{Database, DatabaseError};
use crate::models::todo::{Priority, TimeAction, Todo, TodoStatus};

#[derive(Subcommand)]
pub enum TodoAction {
    /// List todos
    List {
        #[arg(long)]
        status: Option<TodoStatus>,
        #[arg(long)]
        priority: Option<Priority>,
        #[arg(long)]
        tag: Option<String>,
        #[arg(long)]
        due_before: Option<String>,
        #[arg(long)]
        due_after: Option<String>,
        #[arg(long)]
        deleted: bool,
    },
    /// Add a new todo
    Add {
        /// Todo title
        title: String,
        /// Description
        #[arg(long, short)]
        description: Option<String>,
        /// Priority level
        #[arg(long, short, default_value = "medium")]
        priority: Priority,
        /// Due date (YYYY-MM-DD)
        #[arg(long)]
        due: Option<String>,
        /// Tags (repeatable)
        #[arg(long)]
        tag: Vec<String>,
        /// Link to goal ID (repeatable)
        #[arg(long)]
        goal: Vec<i64>,
    },
    /// Edit an existing todo
    Edit {
        id: i64,
        #[arg(long)]
        title: Option<String>,
        #[arg(long, short)]
        description: Option<String>,
        #[arg(long, short)]
        priority: Option<Priority>,
        #[arg(long)]
        due: Option<String>,
        /// Tags (replaces existing, repeatable)
        #[arg(long)]
        tag: Vec<String>,
    },
    /// Show todo details
    Show { id: i64 },
    /// Start working on a todo
    Start { id: i64 },
    /// Pause a todo
    Pause { id: i64 },
    /// Resume a paused todo
    Resume { id: i64 },
    /// Mark a todo as done
    Done { id: i64 },
    /// Cancel a todo
    Cancel { id: i64 },
    /// Soft-delete a todo
    Delete { id: i64 },
    /// Restore a soft-deleted todo
    Restore { id: i64 },
    /// Permanently remove a todo (by ID, or --all for bulk purge of deleted items)
    Purge {
        /// Todo ID (omit if using --all)
        id: Option<i64>,
        /// Purge all soft-deleted items
        #[arg(long)]
        all: bool,
        /// Only purge items deleted more than N days ago (e.g., "90d")
        #[arg(long)]
        older_than: Option<String>,
    },
}

pub fn handle(action: TodoAction, db: &Database) -> Result<(), DatabaseError> {
    match action {
        TodoAction::Add { title, description, priority, due, tag, goal } => {
            let title = super::require(&title, "title")?;
            let due_date = parse_date_opt(&due)?;
            let todo = TodoRepository::create(db, CreateTodo {
                title, description, priority, due_date,
            })?;
            apply_tags(db, EntityType::Todo, todo.id, &tag)?;
            for goal_id in &goal {
                GoalRepository::link_todo(db, *goal_id, todo.id)?;
            }
            let todo = TodoRepository::get_by_id(db, todo.id)?
                .ok_or(DatabaseError::NotFound { entity: "todo", id: todo.id })?;
            print_todo(&todo);
            println!("Todo #{} created.", todo.id);
            Ok(())
        }
        TodoAction::List { status, priority, tag, due_before, due_after, deleted } => {
            let filter = TodoFilter {
                status, priority, tag,
                due_before: parse_date_opt(&due_before)?,
                due_after: parse_date_opt(&due_after)?,
                include_deleted: deleted,
            };
            let todos = TodoRepository::list(db, filter)?;
            print_list(&todos, "todo", print_todo_row);
            Ok(())
        }
        TodoAction::Show { id } => {
            let todo = TodoRepository::get_by_id(db, id)?
                .ok_or(DatabaseError::NotFound { entity: "todo", id })?;
            print_todo(&todo);
            let entries = TodoRepository::get_time_entries(db, id)?;
            if !entries.is_empty() {
                println!("\nTime entries:");
                for entry in &entries {
                    println!("  {} at {}", entry.action, entry.timestamp.format("%Y-%m-%d %H:%M"));
                }
                let duration = crate::db::todo::duration_from_entries(&entries, Utc::now());
                let hours = duration.num_hours();
                let mins = duration.num_minutes() % 60;
                println!("  Total: {hours}h {mins}m");
            }
            Ok(())
        }
        TodoAction::Edit { id, title, description, priority, due, tag } => {
            let due_date = due.as_deref().map(parse_date).transpose()?;
            TodoRepository::update(db, id, UpdateTodo {
                title,
                description: description.map(Some),
                status: None,
                priority,
                due_date: due_date.map(Some),
            })?;
            if !tag.is_empty() {
                apply_tags(db, EntityType::Todo, id, &tag)?;
            }
            let todo = TodoRepository::get_by_id(db, id)?
                .ok_or(DatabaseError::NotFound { entity: "todo", id })?;
            print_todo(&todo);
            println!("Todo #{id} updated.");
            Ok(())
        }
        TodoAction::Start { id } => do_transition(db, id, TimeAction::Start),
        TodoAction::Pause { id } => do_transition(db, id, TimeAction::Pause),
        TodoAction::Resume { id } => do_transition(db, id, TimeAction::Resume),
        TodoAction::Done { id } => do_transition(db, id, TimeAction::Done),
        TodoAction::Cancel { id } => do_transition(db, id, TimeAction::Cancel),
        TodoAction::Delete { id } => super::soft_delete::<TodoRepository>(db, id, "Todo"),
        TodoAction::Restore { id } => super::restore::<TodoRepository>(db, id, "Todo"),
        TodoAction::Purge { id, all, older_than } => {
            super::handle_purge::<TodoRepository>(db, id, all, &older_than, "todos", "Todo")
        }
    }
}

fn do_transition(
    db: &Database,
    id: i64,
    action: TimeAction,
) -> Result<(), DatabaseError> {
    let (todo, _entry) = TodoRepository::transition(db, id, action)?;
    print_todo_row(&todo);
    let status = action.target_status();
    println!("Todo #{id} → {status}");

    // On completion, show total duration.
    if status == TodoStatus::Done || status == TodoStatus::Cancelled {
        let entries = TodoRepository::get_time_entries(db, id)?;
        let duration = crate::db::todo::duration_from_entries(&entries, Utc::now());
        let hours = duration.num_hours();
        let mins = duration.num_minutes() % 60;
        println!("Total time: {hours}h {mins}m");
    }
    Ok(())
}

fn print_todo(todo: &Todo) {
    println!("#{} {}", todo.id, todo.title);
    println!("  Status:   {}", todo.status);
    println!("  Priority: {}", todo.priority);
    if let Some(ref desc) = todo.description {
        println!("  Description: {desc}");
    }
    if let Some(due) = todo.due_date {
        println!("  Due: {due}");
    }
    if !todo.tags.is_empty() {
        println!("  Tags: {}", todo.tags.join(", "));
    }
    if todo.deleted_at.is_some() {
        println!("  [DELETED]");
    }
}

fn print_todo_row(todo: &Todo) {
    let due = todo.due_date.map_or(String::new(), |d| format!(" due:{d}"));
    println!(
        "  #{:<4} {:12} {:8} {}{}{}{}",
        todo.id, todo.status, todo.priority, todo.title,
        due, format_tags(&todo.tags), format_deleted(&todo.deleted_at),
    );
}
