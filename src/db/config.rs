use chrono::Utc;
use rusqlite::{params, OptionalExtension};

use super::{Database, DatabaseError};
use crate::models::config::Config;

pub struct ConfigRepository;

impl ConfigRepository {
    pub fn get(db: &Database, key: &str) -> Result<Option<Config>, DatabaseError> {
        db.conn()
            .query_row(
                "SELECT key, value, updated_at FROM config WHERE key = ?1",
                params![key],
                |row| {
                    Ok(Config {
                        key: row.get(0)?,
                        value: row.get(1)?,
                        updated_at: row.get(2)?,
                    })
                },
            )
            .optional()
            .map_err(DatabaseError::Sqlite)
    }

    /// Sets a config value. Creates the key if it doesn't exist, updates if it does.
    pub fn set(db: &Database, key: &str, value: &str) -> Result<Config, DatabaseError> {
        let now = Utc::now();
        db.conn()
            .execute(
                "INSERT INTO config (key, value, updated_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3",
                params![key, value, now],
            )
            ?;

        Ok(Config {
            key: key.to_string(),
            value: value.to_string(),
            updated_at: now,
        })
    }

    pub fn list(db: &Database) -> Result<Vec<Config>, DatabaseError> {
        let mut stmt = db
            .conn()
            .prepare("SELECT key, value, updated_at FROM config ORDER BY key")
            ?;

        let configs = stmt
            .query_map([], |row| {
                Ok(Config {
                    key: row.get(0)?,
                    value: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            })
            ?
            .collect::<Result<Vec<_>, _>>()
            ?;

        Ok(configs)
    }

    pub fn delete(db: &Database, key: &str) -> Result<(), DatabaseError> {
        db.conn()
            .execute("DELETE FROM config WHERE key = ?1", params![key])
            ?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::open_in_memory().unwrap()
    }

    #[test]
    fn set_and_get() {
        let db = test_db();
        ConfigRepository::set(&db, "standup.days", "mon,wed,fri").unwrap();

        let config = ConfigRepository::get(&db, "standup.days").unwrap().unwrap();
        assert_eq!(config.key, "standup.days");
        assert_eq!(config.value, "mon,wed,fri");
    }

    #[test]
    fn get_missing_returns_none() {
        let db = test_db();
        assert!(ConfigRepository::get(&db, "nope").unwrap().is_none());
    }

    #[test]
    fn set_upserts() {
        let db = test_db();
        ConfigRepository::set(&db, "key", "v1").unwrap();
        ConfigRepository::set(&db, "key", "v2").unwrap();

        let config = ConfigRepository::get(&db, "key").unwrap().unwrap();
        assert_eq!(config.value, "v2");

        // Should be only one row.
        let all = ConfigRepository::list(&db).unwrap();
        assert_eq!(all.len(), 1);
    }

    #[test]
    fn list_all() {
        let db = test_db();
        ConfigRepository::set(&db, "a.key", "val1").unwrap();
        ConfigRepository::set(&db, "b.key", "val2").unwrap();

        let all = ConfigRepository::list(&db).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].key, "a.key");
        assert_eq!(all[1].key, "b.key");
    }

    #[test]
    fn delete_key() {
        let db = test_db();
        ConfigRepository::set(&db, "key", "val").unwrap();
        ConfigRepository::delete(&db, "key").unwrap();
        assert!(ConfigRepository::get(&db, "key").unwrap().is_none());
    }

    #[test]
    fn delete_missing_is_noop() {
        let db = test_db();
        ConfigRepository::delete(&db, "nope").unwrap(); // no error
    }
}
