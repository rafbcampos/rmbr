pub mod config;
pub mod goal;
pub mod kudo;
pub mod repository;
pub mod tag;
pub mod til;
pub mod todo;

pub mod query;

use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{params, Connection};

/// The current schema version. Bump this and add a migration branch
/// in `Database::migrate` whenever the schema changes.
const SCHEMA_VERSION: u32 = 1;

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Opens (or creates) the database at `path`, creates parent directories
    /// if needed, enables WAL mode and foreign keys, and runs any pending
    /// migrations.
    pub fn open(path: &Path) -> Result<Self, DatabaseError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| DatabaseError::Io {
                path: parent.to_path_buf(),
                source: e,
            })?;
        }

        let conn = Connection::open(path).map_err(DatabaseError::Sqlite)?;
        let db = Self { conn };
        db.init()?;
        Ok(db)
    }

    /// Opens an in-memory database — useful for tests.
    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, DatabaseError> {
        let conn = Connection::open_in_memory().map_err(DatabaseError::Sqlite)?;
        let db = Self { conn };
        db.init()?;
        Ok(db)
    }

    /// Returns the resolved default database path for the current platform.
    /// Linux:  ~/.local/share/rmbr/rmbr.db
    /// macOS:  ~/Library/Application Support/rmbr/rmbr.db
    /// Respects RMBR_DB_PATH env var override.
    pub fn default_path() -> Result<PathBuf, DatabaseError> {
        if let Ok(override_path) = std::env::var("RMBR_DB_PATH") {
            return Ok(PathBuf::from(override_path));
        }

        let data_dir = dirs::data_dir().ok_or(DatabaseError::NoDataDir)?;
        Ok(data_dir.join("rmbr").join("rmbr.db"))
    }

    /// Returns a reference to the underlying connection.
    /// Used by repository implementations.
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Shared initialization: pragmas + migrations.
    fn init(&self) -> Result<(), DatabaseError> {
        self.conn
            .execute_batch(
                "PRAGMA journal_mode = WAL;
                 PRAGMA foreign_keys = ON;",
            )
            .map_err(DatabaseError::Sqlite)?;

        self.migrate()
    }

    /// Returns the current schema version stored in the database.
    fn schema_version(&self) -> Result<u32, DatabaseError> {
        let version: u32 = self
            .conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(DatabaseError::Sqlite)?;
        Ok(version)
    }

    /// Sets the schema version in the database.
    fn set_schema_version(&self, version: u32) -> Result<(), DatabaseError> {
        // PRAGMA doesn't support parameter binding, so we format directly.
        // This is safe because `version` is a u32, not user input.
        self.conn
            .execute_batch(&format!("PRAGMA user_version = {version};"))
            .map_err(DatabaseError::Sqlite)?;
        Ok(())
    }

    /// Runs all pending migrations from the current version up to
    /// SCHEMA_VERSION.
    fn migrate(&self) -> Result<(), DatabaseError> {
        let current = self.schema_version()?;

        if current > SCHEMA_VERSION {
            return Err(DatabaseError::SchemaVersionTooNew {
                current,
                expected: SCHEMA_VERSION,
            });
        }

        if current < 1 {
            self.migrate_v0_to_v1()?;
        }

        self.set_schema_version(SCHEMA_VERSION)?;
        Ok(())
    }

    /// v0 → v1: Create all initial tables.
    fn migrate_v0_to_v1(&self) -> Result<(), DatabaseError> {
        self.conn
            .execute_batch(
                "
                -- Todos
                CREATE TABLE todos (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    title       TEXT    NOT NULL,
                    description TEXT,
                    status      TEXT    NOT NULL DEFAULT 'pending',
                    priority    TEXT    NOT NULL DEFAULT 'medium',
                    due_date    TEXT,
                    created_at  TEXT    NOT NULL,
                    updated_at  TEXT    NOT NULL,
                    deleted_at  TEXT
                );

                -- Todo time tracking (event log)
                CREATE TABLE todo_time_entries (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    todo_id   INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
                    action    TEXT    NOT NULL,
                    timestamp TEXT    NOT NULL
                );
                CREATE INDEX idx_time_entries_todo ON todo_time_entries(todo_id);

                -- Goals (STAR framework)
                CREATE TABLE goals (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    title      TEXT    NOT NULL,
                    situation  TEXT,
                    task       TEXT,
                    action     TEXT,
                    result     TEXT,
                    status     TEXT    NOT NULL DEFAULT 'not-started',
                    due_date   TEXT,
                    created_at TEXT    NOT NULL,
                    updated_at TEXT    NOT NULL,
                    deleted_at TEXT
                );

                -- Todo ↔ Goal (many-to-many)
                CREATE TABLE todo_goals (
                    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
                    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
                    PRIMARY KEY (todo_id, goal_id)
                );

                -- Kudos
                CREATE TABLE kudos (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    title       TEXT    NOT NULL,
                    description TEXT,
                    from_name   TEXT,
                    from_slack  TEXT,
                    to_name     TEXT,
                    to_slack    TEXT,
                    date        TEXT    NOT NULL,
                    created_at  TEXT    NOT NULL,
                    updated_at  TEXT    NOT NULL,
                    deleted_at  TEXT
                );

                -- Kudo ↔ Goal (many-to-many)
                CREATE TABLE kudo_goals (
                    kudo_id INTEGER NOT NULL REFERENCES kudos(id) ON DELETE CASCADE,
                    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
                    PRIMARY KEY (kudo_id, goal_id)
                );

                -- TILs (Today I Learned)
                CREATE TABLE tils (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    title      TEXT NOT NULL,
                    body       TEXT NOT NULL,
                    source     TEXT,
                    category   TEXT NOT NULL DEFAULT 'technical',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT
                );

                -- Tags (managed)
                CREATE TABLE tags (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    name       TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                );

                -- Tag junction tables
                CREATE TABLE todo_tags (
                    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
                    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (todo_id, tag_id)
                );

                CREATE TABLE goal_tags (
                    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
                    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (goal_id, tag_id)
                );

                CREATE TABLE kudo_tags (
                    kudo_id INTEGER NOT NULL REFERENCES kudos(id) ON DELETE CASCADE,
                    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (kudo_id, tag_id)
                );

                CREATE TABLE til_tags (
                    til_id INTEGER NOT NULL REFERENCES tils(id) ON DELETE CASCADE,
                    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (til_id, tag_id)
                );

                -- Config (key-value)
                CREATE TABLE config (
                    key        TEXT PRIMARY KEY,
                    value      TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                ",
            )
            .map_err(DatabaseError::Sqlite)?;
        Ok(())
    }

    // --- Shared helpers for repositories ------------------------------------

    /// Soft-deletes a row by setting `deleted_at`. Returns `NotFound` if no
    /// matching non-deleted row exists.
    pub fn soft_delete_row(&self, table: &str, entity: &'static str, id: i64) -> Result<(), DatabaseError> {
        let now = Utc::now();
        let affected = self
            .conn
            .execute(
                &format!(
                    "UPDATE {table} SET deleted_at = ?1, updated_at = ?1 \
                     WHERE id = ?2 AND deleted_at IS NULL"
                ),
                params![now, id],
            )?;
        if affected == 0 {
            return Err(DatabaseError::NotFound { entity, id });
        }
        Ok(())
    }

    /// Restores a soft-deleted row. Returns `NotFound` if no deleted row with
    /// that ID exists.
    pub fn restore_row(&self, table: &str, entity: &'static str, id: i64) -> Result<(), DatabaseError> {
        let now = Utc::now();
        let affected = self
            .conn
            .execute(
                &format!(
                    "UPDATE {table} SET deleted_at = NULL, updated_at = ?1 \
                     WHERE id = ?2 AND deleted_at IS NOT NULL"
                ),
                params![now, id],
            )?;
        if affected == 0 {
            return Err(DatabaseError::NotFound { entity, id });
        }
        Ok(())
    }

    /// Permanently deletes a row. Returns `NotFound` if no row with that ID
    /// exists.
    pub fn purge_row(&self, table: &str, entity: &'static str, id: i64) -> Result<(), DatabaseError> {
        let affected = self
            .conn
            .execute(
                &format!("DELETE FROM {table} WHERE id = ?1"),
                params![id],
            )?;
        if affected == 0 {
            return Err(DatabaseError::NotFound { entity, id });
        }
        Ok(())
    }

    /// Permanently deletes all soft-deleted rows older than `older_than_days` days.
    /// If `older_than_days` is None, purges all soft-deleted rows.
    /// Returns the number of rows purged.
    pub fn purge_deleted(
        &self,
        table: &str,
        older_than_days: Option<i64>,
    ) -> Result<usize, DatabaseError> {
        let affected = match older_than_days {
            Some(days) => {
                let cutoff = Utc::now() - chrono::Duration::days(days);
                self.conn.execute(
                    &format!("DELETE FROM {table} WHERE deleted_at IS NOT NULL AND deleted_at < ?1"),
                    params![cutoff],
                )?
            }
            None => {
                self.conn.execute(
                    &format!("DELETE FROM {table} WHERE deleted_at IS NOT NULL"),
                    [],
                )?
            }
        };
        Ok(affected)
    }
}

/// Parses a string column value into an enum that implements `FromStr`.
/// Wraps the parse error into `rusqlite::Error::FromSqlConversionFailure`
/// so it integrates cleanly with row mappers.
pub fn parse_enum_column<T: std::str::FromStr>(value: &str) -> Result<T, rusqlite::Error>
where
    T::Err: std::error::Error + Send + Sync + 'static,
{
    value.parse::<T>().map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })
}

#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("failed to create directory {}: {source}", path.display())]
    Io {
        path: PathBuf,
        source: std::io::Error,
    },

    #[error("could not determine data directory; set RMBR_DB_PATH env var")]
    NoDataDir,

    #[error(
        "database schema version {current} is newer than supported version {expected}; upgrade rmbr"
    )]
    SchemaVersionTooNew { current: u32, expected: u32 },

    #[error("{entity} with id {id} not found")]
    NotFound { entity: &'static str, id: i64 },

    #[error("invalid status transition from '{from}' to '{to}'")]
    InvalidTransition { from: String, to: String },

    #[error("{message}")]
    InvalidInput { message: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_in_memory_creates_all_tables() {
        let db = Database::open_in_memory().unwrap();

        let tables: Vec<String> = db
            .conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        let expected = vec![
            "config",
            "goal_tags",
            "goals",
            "kudo_goals",
            "kudo_tags",
            "kudos",
            "tags",
            "til_tags",
            "tils",
            "todo_goals",
            "todo_tags",
            "todo_time_entries",
            "todos",
        ];
        assert_eq!(tables, expected);
    }

    #[test]
    fn schema_version_is_set_after_migration() {
        let db = Database::open_in_memory().unwrap();
        assert_eq!(db.schema_version().unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn idempotent_reopen() {
        // First open creates the schema.
        let db = Database::open_in_memory().unwrap();
        assert_eq!(db.schema_version().unwrap(), 1);

        // Simulate reopening by running init again on the same connection.
        // This should not fail — migrations detect version and skip.
        db.init().unwrap();
        assert_eq!(db.schema_version().unwrap(), 1);
    }

    #[test]
    fn foreign_keys_are_enabled() {
        let db = Database::open_in_memory().unwrap();
        let fk_enabled: i32 = db
            .conn
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .unwrap();
        assert_eq!(fk_enabled, 1);
    }

    #[test]
    fn foreign_key_cascade_works() {
        let db = Database::open_in_memory().unwrap();

        // Insert a todo, then a time entry referencing it.
        db.conn
            .execute(
                "INSERT INTO todos (id, title, status, priority, created_at, updated_at)
                 VALUES (1, 'test', 'pending', 'medium', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO todo_time_entries (todo_id, action, timestamp)
                 VALUES (1, 'start', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();

        // Delete the todo — time entry should cascade.
        db.conn
            .execute("DELETE FROM todos WHERE id = 1", [])
            .unwrap();

        let count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM todo_time_entries WHERE todo_id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn junction_table_cascade_on_delete() {
        let db = Database::open_in_memory().unwrap();

        // Insert a todo and a goal, then link them.
        db.conn
            .execute(
                "INSERT INTO todos (id, title, status, priority, created_at, updated_at)
                 VALUES (1, 'todo', 'pending', 'medium', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO goals (id, title, status, created_at, updated_at)
                 VALUES (1, 'goal', 'not-started', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO todo_goals (todo_id, goal_id) VALUES (1, 1)",
                [],
            )
            .unwrap();

        // Delete the todo — junction row should cascade.
        db.conn
            .execute("DELETE FROM todos WHERE id = 1", [])
            .unwrap();

        let count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM todo_goals", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn schema_version_too_new_returns_error() {
        let db = Database::open_in_memory().unwrap();

        // Artificially set the version higher than supported.
        db.set_schema_version(999).unwrap();

        let err = db.migrate().unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("999"),
            "error should mention the current version: {msg}"
        );
        assert!(
            msg.contains("newer"),
            "error should explain version is too new: {msg}"
        );
    }

    #[test]
    fn tag_name_uniqueness_enforced() {
        let db = Database::open_in_memory().unwrap();

        db.conn
            .execute(
                "INSERT INTO tags (name, created_at) VALUES ('backend', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();

        let result = db.conn.execute(
            "INSERT INTO tags (name, created_at) VALUES ('backend', '2026-01-01T00:00:00Z')",
            [],
        );
        assert!(result.is_err(), "duplicate tag name should be rejected");
    }

    #[test]
    fn open_file_based_db() {
        let dir = std::env::temp_dir().join("rmbr_test_open_file");
        let _ = fs::remove_dir_all(&dir);
        let db_path = dir.join("test.db");

        let db = Database::open(&db_path).unwrap();
        assert_eq!(db.schema_version().unwrap(), SCHEMA_VERSION);
        assert!(db_path.exists());

        // Reopen — should be idempotent.
        let db2 = Database::open(&db_path).unwrap();
        assert_eq!(db2.schema_version().unwrap(), SCHEMA_VERSION);

        let _ = fs::remove_dir_all(&dir);
    }
}
