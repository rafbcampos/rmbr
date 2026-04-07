use chrono::{NaiveDate, Utc};
use rusqlite::{params, OptionalExtension, Row};

use super::parse_enum_column;
use super::query::QueryBuilder;
use super::repository::CrudRepository;
use super::tag::{populate_tags, populate_tags_bulk};
use super::todo::row_to_todo;
use super::{Database, DatabaseError};
use crate::models::goal::{Goal, GoalStatus};
use crate::models::todo::Todo;

pub struct GoalRepository;

// --- Input / filter types ---------------------------------------------------

pub struct CreateGoal {
    pub title: String,
    pub situation: Option<String>,
    pub task: Option<String>,
    pub action: Option<String>,
    pub result: Option<String>,
    pub due_date: Option<NaiveDate>,
}

pub struct UpdateGoal {
    pub title: Option<String>,
    pub situation: Option<Option<String>>,
    pub task: Option<Option<String>>,
    pub action: Option<Option<String>>,
    pub result: Option<Option<String>>,
    pub status: Option<GoalStatus>,
    pub due_date: Option<Option<NaiveDate>>,
}

#[derive(Default)]
pub struct GoalFilter {
    pub status: Option<GoalStatus>,
    pub due_before: Option<NaiveDate>,
    pub due_after: Option<NaiveDate>,
    pub tag: Option<String>,
    pub include_deleted: bool,
}

// --- Row mapping ------------------------------------------------------------

pub(crate) fn row_to_goal(row: &Row<'_>) -> Result<Goal, rusqlite::Error> {
    Ok(Goal {
        id: row.get("id")?,
        title: row.get("title")?,
        situation: row.get("situation")?,
        task: row.get("task")?,
        action: row.get("action")?,
        result: row.get("result")?,
        status: parse_enum_column(&row.get::<_, String>("status")?)?,
        due_date: row.get("due_date")?,
        tags: Vec::new(),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

// --- CrudRepository impl ----------------------------------------------------

impl CrudRepository for GoalRepository {
    type Entity = Goal;
    type CreateInput = CreateGoal;
    type UpdateInput = UpdateGoal;
    type Filter = GoalFilter;

    fn create(db: &Database, input: CreateGoal) -> Result<Goal, DatabaseError> {
        let now = Utc::now();
        db.conn().execute(
            "INSERT INTO goals (title, situation, task, action, result, status, due_date, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                input.title,
                input.situation,
                input.task,
                input.action,
                input.result,
                GoalStatus::NotStarted.to_string(),
                input.due_date,
                now,
                now,
            ],
        )?;

        let id = db.conn().last_insert_rowid();
        Self::get_by_id(db, id)?.ok_or(DatabaseError::NotFound { entity: "goal", id })
    }

    fn get_by_id(db: &Database, id: i64) -> Result<Option<Goal>, DatabaseError> {
        let mut stmt = db.conn().prepare("SELECT * FROM goals WHERE id = ?1")?;
        let mut goal = stmt.query_row(params![id], row_to_goal).optional()?;

        if let Some(ref mut g) = goal {
            populate_tags(db, g)?;
        }
        Ok(goal)
    }

    fn list(db: &Database, filter: GoalFilter) -> Result<Vec<Goal>, DatabaseError> {
        let mut qb = QueryBuilder::new("SELECT DISTINCT g.* FROM goals g");

        if let Some(ref tag) = filter.tag {
            qb.join("JOIN goal_tags gt ON gt.goal_id = g.id")
              .join("JOIN tags tg ON tg.id = gt.tag_id")
              .filter("tg.name = {}", Box::new(tag.clone()));
        }
        if !filter.include_deleted {
            qb.filter_raw("g.deleted_at IS NULL");
        }
        if let Some(status) = filter.status {
            qb.filter("g.status = {}", Box::new(status.to_string()));
        }
        if let Some(due_before) = filter.due_before {
            qb.filter("g.due_date <= {}", Box::new(due_before));
        }
        if let Some(due_after) = filter.due_after {
            qb.filter("g.due_date >= {}", Box::new(due_after));
        }
        qb.order_by("g.created_at DESC");

        let mut stmt = db.conn().prepare(&qb.build())?;
        let mut goals: Vec<Goal> = stmt
            .query_map(qb.params().as_slice(), row_to_goal)?
            .collect::<Result<Vec<_>, _>>()?;

        populate_tags_bulk(db, &mut goals)?;
        Ok(goals)
    }

    fn update(db: &Database, id: i64, input: UpdateGoal) -> Result<Goal, DatabaseError> {
        let existing = Self::get_by_id(db, id)?
            .ok_or(DatabaseError::NotFound { entity: "goal", id })?;

        let title = input.title.unwrap_or(existing.title);
        let situation = input.situation.unwrap_or(existing.situation);
        let task = input.task.unwrap_or(existing.task);
        let action = input.action.unwrap_or(existing.action);
        let result = input.result.unwrap_or(existing.result);
        let status = input.status.unwrap_or(existing.status);
        let due_date = input.due_date.unwrap_or(existing.due_date);
        let now = Utc::now();

        db.conn().execute(
            "UPDATE goals SET title = ?1, situation = ?2, task = ?3, action = ?4,
             result = ?5, status = ?6, due_date = ?7, updated_at = ?8 WHERE id = ?9",
            params![title, situation, task, action, result, status.to_string(), due_date, now, id],
        )?;

        Self::get_by_id(db, id)?.ok_or(DatabaseError::NotFound { entity: "goal", id })
    }

    fn soft_delete(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.soft_delete_row("goals", "goal", id)
    }

    fn restore(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.restore_row("goals", "goal", id)
    }

    fn purge(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.purge_row("goals", "goal", id)
    }
}

// --- Goal-specific: todo linking ---------------------------------------------

impl GoalRepository {
    pub fn link_todo(db: &Database, goal_id: i64, todo_id: i64) -> Result<(), DatabaseError> {
        db.conn().execute(
            "INSERT OR IGNORE INTO todo_goals (todo_id, goal_id) VALUES (?1, ?2)",
            params![todo_id, goal_id],
        )?;
        Ok(())
    }

    pub fn unlink_todo(db: &Database, goal_id: i64, todo_id: i64) -> Result<(), DatabaseError> {
        db.conn().execute(
            "DELETE FROM todo_goals WHERE todo_id = ?1 AND goal_id = ?2",
            params![todo_id, goal_id],
        )?;
        Ok(())
    }

    pub fn get_linked_todos(db: &Database, goal_id: i64) -> Result<Vec<Todo>, DatabaseError> {
        let mut stmt = db.conn().prepare(
            "SELECT t.* FROM todos t
             JOIN todo_goals tg ON tg.todo_id = t.id
             WHERE tg.goal_id = ?1
             ORDER BY t.created_at DESC",
        )?;

        let mut todos: Vec<Todo> = stmt
            .query_map(params![goal_id], row_to_todo)?
            .collect::<Result<Vec<_>, _>>()?;

        populate_tags_bulk(db, &mut todos)?;
        Ok(todos)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::todo::{CreateTodo, TodoRepository};
    use crate::models::goal::GoalStatus;
    use crate::models::todo::Priority;

    fn test_db() -> Database {
        Database::open_in_memory().unwrap()
    }

    fn create_default_goal(db: &Database, title: &str) -> Goal {
        GoalRepository::create(
            db,
            CreateGoal {
                title: title.to_string(),
                situation: None,
                task: None,
                action: None,
                result: None,
                due_date: None,
            },
        )
        .unwrap()
    }

    fn create_default_todo(db: &Database, title: &str) -> Todo {
        TodoRepository::create(
            db,
            CreateTodo {
                title: title.to_string(),
                description: None,
                priority: Priority::Medium,
                due_date: None,
            },
        )
        .unwrap()
    }

    #[test]
    fn create_and_get_by_id() {
        let db = test_db();
        let goal = GoalRepository::create(
            &db,
            CreateGoal {
                title: "Ship feature X".to_string(),
                situation: Some("Team needs X".to_string()),
                task: Some("Build and ship".to_string()),
                action: None,
                result: None,
                due_date: Some(NaiveDate::from_ymd_opt(2026, 10, 1).unwrap()),
            },
        )
        .unwrap();

        assert_eq!(goal.title, "Ship feature X");
        assert_eq!(goal.status, GoalStatus::NotStarted);
        assert_eq!(goal.situation.as_deref(), Some("Team needs X"));
        assert_eq!(goal.task.as_deref(), Some("Build and ship"));
        assert!(goal.action.is_none());
        assert!(goal.result.is_none());

        let fetched = GoalRepository::get_by_id(&db, goal.id).unwrap().unwrap();
        assert_eq!(fetched.id, goal.id);
    }

    #[test]
    fn get_by_id_returns_none_for_missing() {
        let db = test_db();
        assert!(GoalRepository::get_by_id(&db, 999).unwrap().is_none());
    }

    #[test]
    fn list_excludes_deleted_by_default() {
        let db = test_db();
        let g1 = create_default_goal(&db, "Active");
        let g2 = create_default_goal(&db, "Deleted");
        GoalRepository::soft_delete(&db, g2.id).unwrap();

        let list = GoalRepository::list(&db, GoalFilter::default()).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, g1.id);
    }

    #[test]
    fn list_includes_deleted_when_requested() {
        let db = test_db();
        create_default_goal(&db, "Active");
        let g2 = create_default_goal(&db, "Deleted");
        GoalRepository::soft_delete(&db, g2.id).unwrap();

        let list = GoalRepository::list(
            &db,
            GoalFilter { include_deleted: true, ..Default::default() },
        )
        .unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn filter_by_status() {
        let db = test_db();
        create_default_goal(&db, "Not started");
        let g2 = create_default_goal(&db, "In progress");
        GoalRepository::update(
            &db,
            g2.id,
            UpdateGoal {
                status: Some(GoalStatus::InProgress),
                title: None, situation: None, task: None, action: None, result: None, due_date: None,
            },
        )
        .unwrap();

        let list = GoalRepository::list(
            &db,
            GoalFilter { status: Some(GoalStatus::InProgress), ..Default::default() },
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "In progress");
    }

    #[test]
    fn update_star_fields() {
        let db = test_db();
        let goal = create_default_goal(&db, "Goal");

        let updated = GoalRepository::update(
            &db,
            goal.id,
            UpdateGoal {
                title: None,
                situation: Some(Some("Context here".to_string())),
                task: Some(Some("Do the thing".to_string())),
                action: Some(Some("Did it this way".to_string())),
                result: Some(Some("Shipped successfully".to_string())),
                status: Some(GoalStatus::Achieved),
                due_date: None,
            },
        )
        .unwrap();

        assert_eq!(updated.situation.as_deref(), Some("Context here"));
        assert_eq!(updated.task.as_deref(), Some("Do the thing"));
        assert_eq!(updated.action.as_deref(), Some("Did it this way"));
        assert_eq!(updated.result.as_deref(), Some("Shipped successfully"));
        assert_eq!(updated.status, GoalStatus::Achieved);
        assert_eq!(updated.star_completeness(), 4);
    }

    #[test]
    fn soft_delete_and_restore() {
        let db = test_db();
        let goal = create_default_goal(&db, "Goal");

        GoalRepository::soft_delete(&db, goal.id).unwrap();
        assert!(GoalRepository::get_by_id(&db, goal.id).unwrap().unwrap().deleted_at.is_some());

        GoalRepository::restore(&db, goal.id).unwrap();
        assert!(GoalRepository::get_by_id(&db, goal.id).unwrap().unwrap().deleted_at.is_none());
    }

    #[test]
    fn purge_removes_permanently() {
        let db = test_db();
        let goal = create_default_goal(&db, "Goal");
        GoalRepository::purge(&db, goal.id).unwrap();
        assert!(GoalRepository::get_by_id(&db, goal.id).unwrap().is_none());
    }

    #[test]
    fn link_and_unlink_todo() {
        let db = test_db();
        let goal = create_default_goal(&db, "Goal");
        let todo = create_default_todo(&db, "Todo");

        GoalRepository::link_todo(&db, goal.id, todo.id).unwrap();
        let linked = GoalRepository::get_linked_todos(&db, goal.id).unwrap();
        assert_eq!(linked.len(), 1);
        assert_eq!(linked[0].id, todo.id);

        GoalRepository::unlink_todo(&db, goal.id, todo.id).unwrap();
        assert!(GoalRepository::get_linked_todos(&db, goal.id).unwrap().is_empty());
    }

    #[test]
    fn link_is_idempotent() {
        let db = test_db();
        let goal = create_default_goal(&db, "Goal");
        let todo = create_default_todo(&db, "Todo");

        GoalRepository::link_todo(&db, goal.id, todo.id).unwrap();
        GoalRepository::link_todo(&db, goal.id, todo.id).unwrap();
        assert_eq!(GoalRepository::get_linked_todos(&db, goal.id).unwrap().len(), 1);
    }

    #[test]
    fn linked_todos_have_tags() {
        let db = test_db();
        let goal = create_default_goal(&db, "Goal");
        let todo = create_default_todo(&db, "Tagged todo");

        db.conn()
            .execute("INSERT INTO tags (name, created_at) VALUES ('backend', ?1)", params![Utc::now()])
            .unwrap();
        let tag_id: i64 = db.conn().query_row("SELECT id FROM tags WHERE name = 'backend'", [], |r| r.get(0)).unwrap();
        db.conn().execute("INSERT INTO todo_tags (todo_id, tag_id) VALUES (?1, ?2)", params![todo.id, tag_id]).unwrap();

        GoalRepository::link_todo(&db, goal.id, todo.id).unwrap();
        let linked = GoalRepository::get_linked_todos(&db, goal.id).unwrap();
        assert_eq!(linked[0].tags, vec!["backend".to_string()]);
    }
}
