use chrono::{DateTime, Duration, NaiveDate, Utc};
use rusqlite::{params, OptionalExtension, Row};

use super::parse_enum_column;
use super::query::QueryBuilder;
use super::repository::CrudRepository;
use super::tag::{populate_tags, populate_tags_bulk};
use super::{Database, DatabaseError};
use crate::models::todo::{Priority, TimeAction, Todo, TodoStatus, TodoTimeEntry};

pub struct TodoRepository;

// --- Input / filter types ---------------------------------------------------

pub struct CreateTodo {
    pub title: String,
    pub description: Option<String>,
    pub priority: Priority,
    pub due_date: Option<NaiveDate>,
}

pub struct UpdateTodo {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub status: Option<TodoStatus>,
    pub priority: Option<Priority>,
    pub due_date: Option<Option<NaiveDate>>,
}

#[derive(Default)]
pub struct TodoFilter {
    pub status: Option<TodoStatus>,
    pub priority: Option<Priority>,
    pub tag: Option<String>,
    pub due_before: Option<NaiveDate>,
    pub due_after: Option<NaiveDate>,
    pub include_deleted: bool,
}

// --- Row mapping ------------------------------------------------------------

pub(crate) fn row_to_todo(row: &Row<'_>) -> Result<Todo, rusqlite::Error> {
    Ok(Todo {
        id: row.get("id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        status: parse_enum_column(&row.get::<_, String>("status")?)?,
        priority: parse_enum_column(&row.get::<_, String>("priority")?)?,
        due_date: row.get("due_date")?,
        tags: Vec::new(), // populated via Taggable after the query
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

fn row_to_time_entry(row: &Row<'_>) -> Result<TodoTimeEntry, rusqlite::Error> {
    Ok(TodoTimeEntry {
        id: row.get("id")?,
        todo_id: row.get("todo_id")?,
        action: parse_enum_column(&row.get::<_, String>("action")?)?,
        timestamp: row.get("timestamp")?,
    })
}

// --- CrudRepository impl ----------------------------------------------------

impl CrudRepository for TodoRepository {
    type Entity = Todo;
    type CreateInput = CreateTodo;
    type UpdateInput = UpdateTodo;
    type Filter = TodoFilter;

    fn create(db: &Database, input: CreateTodo) -> Result<Todo, DatabaseError> {
        let now = Utc::now();
        db.conn().execute(
            "INSERT INTO todos (title, description, status, priority, due_date, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                input.title,
                input.description,
                TodoStatus::Pending.to_string(),
                input.priority.to_string(),
                input.due_date,
                now,
                now,
            ],
        )?;

        let id = db.conn().last_insert_rowid();
        Self::get_by_id(db, id)?.ok_or(DatabaseError::NotFound { entity: "todo", id })
    }

    fn get_by_id(db: &Database, id: i64) -> Result<Option<Todo>, DatabaseError> {
        let mut stmt = db.conn().prepare("SELECT * FROM todos WHERE id = ?1")?;
        let mut todo = stmt.query_row(params![id], row_to_todo).optional()?;

        if let Some(ref mut t) = todo {
            populate_tags(db, t)?;
        }
        Ok(todo)
    }

    fn list(db: &Database, filter: TodoFilter) -> Result<Vec<Todo>, DatabaseError> {
        let mut qb = QueryBuilder::new("SELECT DISTINCT t.* FROM todos t");

        if let Some(ref tag) = filter.tag {
            qb.join("JOIN todo_tags tt ON tt.todo_id = t.id")
              .join("JOIN tags tg ON tg.id = tt.tag_id")
              .filter("tg.name = {}", Box::new(tag.clone()));
        }
        if !filter.include_deleted {
            qb.filter_raw("t.deleted_at IS NULL");
        }
        if let Some(status) = filter.status {
            qb.filter("t.status = {}", Box::new(status.to_string()));
        }
        if let Some(priority) = filter.priority {
            qb.filter("t.priority = {}", Box::new(priority.to_string()));
        }
        if let Some(due_before) = filter.due_before {
            qb.filter("t.due_date <= {}", Box::new(due_before));
        }
        if let Some(due_after) = filter.due_after {
            qb.filter("t.due_date >= {}", Box::new(due_after));
        }
        qb.order_by("t.created_at DESC");

        let mut stmt = db.conn().prepare(&qb.build())?;
        let mut todos: Vec<Todo> = stmt
            .query_map(qb.params().as_slice(), row_to_todo)?
            .collect::<Result<Vec<_>, _>>()?;

        populate_tags_bulk(db, &mut todos)?;
        Ok(todos)
    }

    fn update(db: &Database, id: i64, input: UpdateTodo) -> Result<Todo, DatabaseError> {
        let existing = Self::get_by_id(db, id)?
            .ok_or(DatabaseError::NotFound { entity: "todo", id })?;

        // Enforce status transitions if status is changing.
        if let Some(new_status) = input.status
            && new_status != existing.status && !existing.status.can_transition_to(new_status) {
                return Err(DatabaseError::InvalidTransition {
                    from: existing.status.to_string(),
                    to: new_status.to_string(),
                });
            }

        let title = input.title.unwrap_or(existing.title);
        let description = input.description.unwrap_or(existing.description);
        let status = input.status.unwrap_or(existing.status);
        let priority = input.priority.unwrap_or(existing.priority);
        let due_date = input.due_date.unwrap_or(existing.due_date);
        let now = Utc::now();

        db.conn().execute(
            "UPDATE todos SET title = ?1, description = ?2, status = ?3, priority = ?4,
             due_date = ?5, updated_at = ?6 WHERE id = ?7",
            params![
                title,
                description,
                status.to_string(),
                priority.to_string(),
                due_date,
                now,
                id,
            ],
        )?;

        Self::get_by_id(db, id)?.ok_or(DatabaseError::NotFound { entity: "todo", id })
    }

    fn soft_delete(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.soft_delete_row("todos", "todo", id)
    }

    fn restore(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.restore_row("todos", "todo", id)
    }

    fn purge(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.purge_row("todos", "todo", id)
    }
}

// --- Time tracking methods (todo-specific) ----------------------------------

impl TodoRepository {
    /// Atomically validates the status transition, updates the todo status,
    /// and creates a time entry. Returns the updated todo and the time entry.
    ///
    /// This is the single entry point for all status changes with time tracking.
    /// It ensures the event log is always consistent with the status.
    pub fn transition(
        db: &Database,
        id: i64,
        action: TimeAction,
    ) -> Result<(Todo, TodoTimeEntry), DatabaseError> {
        let target_status = action.target_status();

        // Update validates the transition via can_transition_to().
        let todo = Self::update(
            db,
            id,
            UpdateTodo {
                title: None,
                description: None,
                status: Some(target_status),
                priority: None,
                due_date: None,
            },
        )?;

        let entry = Self::add_time_entry(db, id, action)?;
        Ok((todo, entry))
    }

    pub fn add_time_entry(
        db: &Database,
        todo_id: i64,
        action: TimeAction,
    ) -> Result<TodoTimeEntry, DatabaseError> {
        let now = Utc::now();
        db.conn().execute(
            "INSERT INTO todo_time_entries (todo_id, action, timestamp)
             VALUES (?1, ?2, ?3)",
            params![todo_id, action.to_string(), now],
        )?;

        let id = db.conn().last_insert_rowid();
        Ok(TodoTimeEntry {
            id,
            todo_id,
            action,
            timestamp: now,
        })
    }

    pub fn get_time_entries(
        db: &Database,
        todo_id: i64,
    ) -> Result<Vec<TodoTimeEntry>, DatabaseError> {
        let mut stmt = db.conn().prepare(
            "SELECT * FROM todo_time_entries WHERE todo_id = ?1 ORDER BY timestamp ASC",
        )?;

        let entries = stmt
            .query_map(params![todo_id], row_to_time_entry)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(entries)
    }

}

/// Pure function to compute duration from a list of time entries.
/// Accepts `now` parameter for deterministic testing of open intervals.
pub fn duration_from_entries(entries: &[TodoTimeEntry], now: DateTime<Utc>) -> Duration {
    let mut total = Duration::zero();
    let mut active_since: Option<DateTime<Utc>> = None;

    for entry in entries {
        match entry.action {
            TimeAction::Start | TimeAction::Resume => {
                active_since = Some(entry.timestamp);
            }
            TimeAction::Pause | TimeAction::Done | TimeAction::Cancel => {
                if let Some(start) = active_since.take() {
                    total += entry.timestamp - start;
                }
            }
        }
    }

    // If still active (open interval), count up to `now`.
    if let Some(start) = active_since {
        total += now - start;
    }

    total
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::todo::{Priority, TimeAction, TodoStatus};

    fn test_db() -> Database {
        Database::open_in_memory().unwrap()
    }

    fn create_default(db: &Database, title: &str) -> Todo {
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
        let todo = create_default(&db, "Write tests");

        assert_eq!(todo.title, "Write tests");
        assert_eq!(todo.status, TodoStatus::Pending);
        assert_eq!(todo.priority, Priority::Medium);
        assert!(todo.description.is_none());
        assert!(todo.due_date.is_none());
        assert!(todo.deleted_at.is_none());
        assert!(todo.tags.is_empty());

        let fetched = TodoRepository::get_by_id(&db, todo.id).unwrap().unwrap();
        assert_eq!(fetched.id, todo.id);
        assert_eq!(fetched.title, "Write tests");
    }

    #[test]
    fn get_by_id_returns_none_for_missing() {
        let db = test_db();
        assert!(TodoRepository::get_by_id(&db, 999).unwrap().is_none());
    }

    #[test]
    fn list_excludes_deleted_by_default() {
        let db = test_db();
        let t1 = create_default(&db, "Active");
        let t2 = create_default(&db, "Deleted");
        TodoRepository::soft_delete(&db, t2.id).unwrap();

        let list = TodoRepository::list(&db, TodoFilter::default()).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, t1.id);
    }

    #[test]
    fn list_includes_deleted_when_requested() {
        let db = test_db();
        create_default(&db, "Active");
        let t2 = create_default(&db, "Deleted");
        TodoRepository::soft_delete(&db, t2.id).unwrap();

        let list = TodoRepository::list(
            &db,
            TodoFilter {
                include_deleted: true,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn filter_by_status() {
        let db = test_db();
        create_default(&db, "Pending one");
        let t2 = create_default(&db, "In progress");
        TodoRepository::update(
            &db,
            t2.id,
            UpdateTodo {
                status: Some(TodoStatus::InProgress),
                title: None,
                description: None,
                priority: None,
                due_date: None,
            },
        )
        .unwrap();

        let list = TodoRepository::list(
            &db,
            TodoFilter {
                status: Some(TodoStatus::InProgress),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "In progress");
    }

    #[test]
    fn filter_by_priority() {
        let db = test_db();
        TodoRepository::create(
            &db,
            CreateTodo {
                title: "Low".to_string(),
                description: None,
                priority: Priority::Low,
                due_date: None,
            },
        )
        .unwrap();
        TodoRepository::create(
            &db,
            CreateTodo {
                title: "Urgent".to_string(),
                description: None,
                priority: Priority::Urgent,
                due_date: None,
            },
        )
        .unwrap();

        let list = TodoRepository::list(
            &db,
            TodoFilter {
                priority: Some(Priority::Urgent),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "Urgent");
    }

    #[test]
    fn filter_by_tag() {
        let db = test_db();
        let t1 = create_default(&db, "Tagged");
        let _t2 = create_default(&db, "Untagged");

        db.conn()
            .execute(
                "INSERT INTO tags (name, created_at) VALUES ('backend', ?1)",
                params![Utc::now()],
            )
            .unwrap();
        let tag_id: i64 = db
            .conn()
            .query_row("SELECT id FROM tags WHERE name = 'backend'", [], |r| r.get(0))
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO todo_tags (todo_id, tag_id) VALUES (?1, ?2)",
                params![t1.id, tag_id],
            )
            .unwrap();

        let list = TodoRepository::list(
            &db,
            TodoFilter {
                tag: Some("backend".to_string()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "Tagged");
        assert_eq!(list[0].tags, vec!["backend".to_string()]);
    }

    #[test]
    fn update_fields() {
        let db = test_db();
        let todo = create_default(&db, "Original");

        let updated = TodoRepository::update(
            &db,
            todo.id,
            UpdateTodo {
                title: Some("Updated".to_string()),
                description: Some(Some("A description".to_string())),
                status: Some(TodoStatus::InProgress),
                priority: Some(Priority::High),
                due_date: None,
            },
        )
        .unwrap();

        assert_eq!(updated.title, "Updated");
        assert_eq!(updated.description.as_deref(), Some("A description"));
        assert_eq!(updated.status, TodoStatus::InProgress);
        assert_eq!(updated.priority, Priority::High);
        assert!(updated.updated_at > todo.updated_at);
    }

    #[test]
    fn soft_delete_and_restore() {
        let db = test_db();
        let todo = create_default(&db, "Will be deleted");

        TodoRepository::soft_delete(&db, todo.id).unwrap();
        let deleted = TodoRepository::get_by_id(&db, todo.id).unwrap().unwrap();
        assert!(deleted.deleted_at.is_some());

        TodoRepository::restore(&db, todo.id).unwrap();
        let restored = TodoRepository::get_by_id(&db, todo.id).unwrap().unwrap();
        assert!(restored.deleted_at.is_none());
    }

    #[test]
    fn purge_removes_permanently() {
        let db = test_db();
        let todo = create_default(&db, "Will be purged");

        TodoRepository::purge(&db, todo.id).unwrap();
        assert!(TodoRepository::get_by_id(&db, todo.id).unwrap().is_none());
    }

    #[test]
    fn time_entries_create_and_list() {
        let db = test_db();
        let todo = create_default(&db, "Timed");

        TodoRepository::add_time_entry(&db, todo.id, TimeAction::Start).unwrap();
        TodoRepository::add_time_entry(&db, todo.id, TimeAction::Pause).unwrap();
        TodoRepository::add_time_entry(&db, todo.id, TimeAction::Resume).unwrap();
        TodoRepository::add_time_entry(&db, todo.id, TimeAction::Done).unwrap();

        let entries = TodoRepository::get_time_entries(&db, todo.id).unwrap();
        assert_eq!(entries.len(), 4);
        assert_eq!(entries[0].action, TimeAction::Start);
        assert_eq!(entries[1].action, TimeAction::Pause);
        assert_eq!(entries[2].action, TimeAction::Resume);
        assert_eq!(entries[3].action, TimeAction::Done);
    }

    #[test]
    fn duration_from_entries_paired_intervals() {
        let base = Utc::now();
        let entries = vec![
            TodoTimeEntry { id: 1, todo_id: 1, action: TimeAction::Start,  timestamp: base },
            TodoTimeEntry { id: 2, todo_id: 1, action: TimeAction::Pause,  timestamp: base + Duration::minutes(30) },
            TodoTimeEntry { id: 3, todo_id: 1, action: TimeAction::Resume, timestamp: base + Duration::hours(1) },
            TodoTimeEntry { id: 4, todo_id: 1, action: TimeAction::Done,   timestamp: base + Duration::hours(1) + Duration::minutes(15) },
        ];

        let dur = duration_from_entries(&entries, base + Duration::hours(2));
        assert_eq!(dur.num_minutes(), 45);
    }

    #[test]
    fn duration_from_entries_empty() {
        let dur = duration_from_entries(&[], Utc::now());
        assert_eq!(dur.num_seconds(), 0);
    }

    #[test]
    fn duration_from_entries_open_interval() {
        let base = Utc::now();
        let entries = vec![
            TodoTimeEntry { id: 1, todo_id: 1, action: TimeAction::Start, timestamp: base },
        ];
        let now = base + Duration::minutes(20);
        let dur = duration_from_entries(&entries, now);
        assert_eq!(dur.num_minutes(), 20);
    }

    #[test]
    fn filter_by_due_date_range() {
        let db = test_db();
        TodoRepository::create(
            &db,
            CreateTodo {
                title: "Due soon".to_string(),
                description: None,
                priority: Priority::Medium,
                due_date: Some(NaiveDate::from_ymd_opt(2026, 4, 10).unwrap()),
            },
        )
        .unwrap();
        TodoRepository::create(
            &db,
            CreateTodo {
                title: "Due later".to_string(),
                description: None,
                priority: Priority::Medium,
                due_date: Some(NaiveDate::from_ymd_opt(2026, 12, 31).unwrap()),
            },
        )
        .unwrap();

        let list = TodoRepository::list(
            &db,
            TodoFilter {
                due_before: Some(NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "Due soon");

        let list = TodoRepository::list(
            &db,
            TodoFilter {
                due_after: Some(NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "Due later");
    }

    #[test]
    fn soft_delete_nonexistent_returns_not_found() {
        let db = test_db();
        let err = TodoRepository::soft_delete(&db, 999).unwrap_err();
        assert!(matches!(err, DatabaseError::NotFound { entity: "todo", id: 999 }));
    }

    #[test]
    fn restore_nonexistent_returns_not_found() {
        let db = test_db();
        let err = TodoRepository::restore(&db, 999).unwrap_err();
        assert!(matches!(err, DatabaseError::NotFound { entity: "todo", id: 999 }));
    }

    #[test]
    fn purge_nonexistent_returns_not_found() {
        let db = test_db();
        let err = TodoRepository::purge(&db, 999).unwrap_err();
        assert!(matches!(err, DatabaseError::NotFound { entity: "todo", id: 999 }));
    }

    #[test]
    fn update_nonexistent_returns_not_found() {
        let db = test_db();
        let err = TodoRepository::update(
            &db,
            999,
            UpdateTodo { title: Some("x".to_string()), description: None, status: None, priority: None, due_date: None },
        )
        .unwrap_err();
        assert!(matches!(err, DatabaseError::NotFound { entity: "todo", id: 999 }));
    }

    #[test]
    fn double_soft_delete_returns_not_found() {
        let db = test_db();
        let todo = create_default(&db, "Todo");
        TodoRepository::soft_delete(&db, todo.id).unwrap();
        let err = TodoRepository::soft_delete(&db, todo.id).unwrap_err();
        assert!(matches!(err, DatabaseError::NotFound { .. }));
    }

    #[test]
    fn valid_transition_pending_to_in_progress() {
        let db = test_db();
        let todo = create_default(&db, "Todo");
        let updated = TodoRepository::update(
            &db,
            todo.id,
            UpdateTodo { status: Some(TodoStatus::InProgress), title: None, description: None, priority: None, due_date: None },
        )
        .unwrap();
        assert_eq!(updated.status, TodoStatus::InProgress);
    }

    #[test]
    fn invalid_transition_pending_to_done() {
        let db = test_db();
        let todo = create_default(&db, "Todo");
        let err = TodoRepository::update(
            &db,
            todo.id,
            UpdateTodo { status: Some(TodoStatus::Done), title: None, description: None, priority: None, due_date: None },
        )
        .unwrap_err();
        assert!(matches!(err, DatabaseError::InvalidTransition { .. }));
    }

    #[test]
    fn invalid_transition_done_to_pending() {
        let db = test_db();
        let todo = create_default(&db, "Todo");
        // Pending → InProgress → Done
        TodoRepository::update(
            &db, todo.id,
            UpdateTodo { status: Some(TodoStatus::InProgress), title: None, description: None, priority: None, due_date: None },
        ).unwrap();
        TodoRepository::update(
            &db, todo.id,
            UpdateTodo { status: Some(TodoStatus::Done), title: None, description: None, priority: None, due_date: None },
        ).unwrap();
        // Done → Pending should fail
        let err = TodoRepository::update(
            &db, todo.id,
            UpdateTodo { status: Some(TodoStatus::Pending), title: None, description: None, priority: None, due_date: None },
        ).unwrap_err();
        assert!(matches!(err, DatabaseError::InvalidTransition { .. }));
    }

    #[test]
    fn same_status_is_not_a_transition() {
        let db = test_db();
        let todo = create_default(&db, "Todo");
        TodoRepository::update(
            &db,
            todo.id,
            UpdateTodo { status: Some(TodoStatus::Pending), title: None, description: None, priority: None, due_date: None },
        )
        .unwrap();
    }

    #[test]
    fn transition_start_done_creates_entries() {
        let db = test_db();
        let todo = create_default(&db, "Task");

        let (updated, entry) = TodoRepository::transition(&db, todo.id, TimeAction::Start).unwrap();
        assert_eq!(updated.status, TodoStatus::InProgress);
        assert_eq!(entry.action, TimeAction::Start);

        let (done, _) = TodoRepository::transition(&db, todo.id, TimeAction::Done).unwrap();
        assert_eq!(done.status, TodoStatus::Done);

        let entries = TodoRepository::get_time_entries(&db, todo.id).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].action, TimeAction::Start);
        assert_eq!(entries[1].action, TimeAction::Done);
    }

    #[test]
    fn transition_invalid_returns_error() {
        let db = test_db();
        let todo = create_default(&db, "Task");
        // Can't pause a pending todo.
        let err = TodoRepository::transition(&db, todo.id, TimeAction::Pause).unwrap_err();
        assert!(matches!(err, DatabaseError::InvalidTransition { .. }));
    }

    #[test]
    fn transition_full_cycle_with_pause() {
        let db = test_db();
        let todo = create_default(&db, "Task");

        TodoRepository::transition(&db, todo.id, TimeAction::Start).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Pause).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Resume).unwrap();
        TodoRepository::transition(&db, todo.id, TimeAction::Done).unwrap();

        let entries = TodoRepository::get_time_entries(&db, todo.id).unwrap();
        assert_eq!(entries.len(), 4);

        let todo = TodoRepository::get_by_id(&db, todo.id).unwrap().unwrap();
        assert_eq!(todo.status, TodoStatus::Done);
    }

    #[test]
    fn duration_multi_pause_resume() {
        let base = Utc::now();
        let entries = vec![
            TodoTimeEntry { id: 1, todo_id: 1, action: TimeAction::Start,  timestamp: base },
            TodoTimeEntry { id: 2, todo_id: 1, action: TimeAction::Pause,  timestamp: base + Duration::minutes(10) },
            TodoTimeEntry { id: 3, todo_id: 1, action: TimeAction::Resume, timestamp: base + Duration::minutes(20) },
            TodoTimeEntry { id: 4, todo_id: 1, action: TimeAction::Pause,  timestamp: base + Duration::minutes(35) },
            TodoTimeEntry { id: 5, todo_id: 1, action: TimeAction::Resume, timestamp: base + Duration::minutes(60) },
            TodoTimeEntry { id: 6, todo_id: 1, action: TimeAction::Done,   timestamp: base + Duration::minutes(70) },
        ];
        // Active: 10min + 15min + 10min = 35min
        let dur = duration_from_entries(&entries, base + Duration::hours(2));
        assert_eq!(dur.num_minutes(), 35);
    }

    #[test]
    fn duration_survives_terminal_close() {
        // Simulates: start at T, no pause/done, then check duration at T+60min.
        // This is the "close terminal and come back" scenario.
        let base = Utc::now() - Duration::minutes(60);
        let entries = vec![
            TodoTimeEntry { id: 1, todo_id: 1, action: TimeAction::Start, timestamp: base },
        ];
        let dur = duration_from_entries(&entries, Utc::now());
        // Should be ~60 minutes (allow 1 minute tolerance for test execution time).
        assert!(dur.num_minutes() >= 59 && dur.num_minutes() <= 61,
            "expected ~60 minutes, got {} minutes", dur.num_minutes());
    }
}
