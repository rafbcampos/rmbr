use chrono::Utc;
use rusqlite::{params, OptionalExtension};

use super::{Database, DatabaseError};
use crate::models::tag::Tag;

/// Trait for entities that carry tags via junction tables.
/// Enables shared `populate_tags` / `populate_tags_bulk` functions.
pub trait Taggable {
    fn entity_id(&self) -> i64;
    fn entity_type() -> EntityType;
    fn set_tags(&mut self, tags: Vec<String>);
}

/// Populates the `tags` field on a single entity by querying its junction table.
pub fn populate_tags<T: Taggable>(db: &Database, entity: &mut T) -> Result<(), DatabaseError> {
    let tags = TagRepository::get_tags_for_entity(db, T::entity_type(), entity.entity_id())?;
    entity.set_tags(tags);
    Ok(())
}

/// Populates the `tags` field on each entity in the slice.
pub fn populate_tags_bulk<T: Taggable>(db: &Database, entities: &mut [T]) -> Result<(), DatabaseError> {
    for entity in entities.iter_mut() {
        populate_tags(db, entity)?;
    }
    Ok(())
}

pub struct TagRepository;

/// Identifies which entity type a tag is associated with.
/// Used to select the correct junction table.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityType {
    Todo,
    Goal,
    Kudo,
    Til,
}

impl EntityType {
    fn junction_table(self) -> &'static str {
        match self {
            Self::Todo => "todo_tags",
            Self::Goal => "goal_tags",
            Self::Kudo => "kudo_tags",
            Self::Til => "til_tags",
        }
    }

    fn fk_column(self) -> &'static str {
        match self {
            Self::Todo => "todo_id",
            Self::Goal => "goal_id",
            Self::Kudo => "kudo_id",
            Self::Til => "til_id",
        }
    }
}

/// Tag with a count of how many entities reference it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TagWithCount {
    pub tag: Tag,
    pub usage_count: i64,
}

impl TagRepository {
    pub fn create(db: &Database, name: &str) -> Result<Tag, DatabaseError> {
        let now = Utc::now();
        db.conn()
            .execute(
                "INSERT INTO tags (name, created_at) VALUES (?1, ?2)",
                params![name, now],
            )
            ?;

        let id = db.conn().last_insert_rowid();
        Ok(Tag {
            id,
            name: name.to_string(),
            created_at: now,
        })
    }

    /// Returns existing tag or creates a new one.
    pub fn get_or_create(db: &Database, name: &str) -> Result<Tag, DatabaseError> {
        let existing = db
            .conn()
            .query_row(
                "SELECT id, name, created_at FROM tags WHERE name = ?1",
                params![name],
                |row| {
                    Ok(Tag {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        created_at: row.get(2)?,
                    })
                },
            )
            .optional()
            ?;

        match existing {
            Some(tag) => Ok(tag),
            None => Self::create(db, name),
        }
    }

    /// Lists all tags with usage counts (total references across all entity types).
    pub fn list(db: &Database) -> Result<Vec<TagWithCount>, DatabaseError> {
        let mut stmt = db
            .conn()
            .prepare(
                "SELECT t.id, t.name, t.created_at,
                    (SELECT COUNT(*) FROM todo_tags WHERE tag_id = t.id) +
                    (SELECT COUNT(*) FROM goal_tags WHERE tag_id = t.id) +
                    (SELECT COUNT(*) FROM kudo_tags WHERE tag_id = t.id) +
                    (SELECT COUNT(*) FROM til_tags WHERE tag_id = t.id) AS usage_count
                 FROM tags t
                 ORDER BY t.name",
            )
            ?;

        let tags = stmt
            .query_map([], |row| {
                Ok(TagWithCount {
                    tag: Tag {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        created_at: row.get(2)?,
                    },
                    usage_count: row.get(3)?,
                })
            })
            ?
            .collect::<Result<Vec<_>, _>>()
            ?;

        Ok(tags)
    }

    pub fn delete(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.conn()
            .execute("DELETE FROM tags WHERE id = ?1", params![id])
            ?;
        Ok(())
    }

    /// Returns tag names for a specific entity.
    pub fn get_tags_for_entity(
        db: &Database,
        entity_type: EntityType,
        entity_id: i64,
    ) -> Result<Vec<String>, DatabaseError> {
        let sql = format!(
            "SELECT t.name FROM tags t
             JOIN {} jt ON jt.tag_id = t.id
             WHERE jt.{} = ?1
             ORDER BY t.name",
            entity_type.junction_table(),
            entity_type.fk_column(),
        );

        let mut stmt = db.conn().prepare(&sql)?;
        let tags = stmt
            .query_map(params![entity_id], |row| row.get(0))
            ?
            .collect::<Result<Vec<String>, _>>()
            ?;

        Ok(tags)
    }

    /// Replaces all tags for a specific entity with the given tag IDs.
    pub fn set_tags_for_entity(
        db: &Database,
        entity_type: EntityType,
        entity_id: i64,
        tag_ids: &[i64],
    ) -> Result<(), DatabaseError> {
        let table = entity_type.junction_table();
        let fk_col = entity_type.fk_column();

        // Clear existing tags.
        db.conn()
            .execute(
                &format!("DELETE FROM {table} WHERE {fk_col} = ?1"),
                params![entity_id],
            )
            ?;

        // Insert new tags.
        let mut stmt = db
            .conn()
            .prepare(&format!(
                "INSERT INTO {table} ({fk_col}, tag_id) VALUES (?1, ?2)"
            ))
            ?;

        for tag_id in tag_ids {
            stmt.execute(params![entity_id, tag_id])
                ?;
        }

        Ok(())
    }

    /// Convenience: set tags by name (get_or_create each, then set).
    pub fn set_tags_by_name(
        db: &Database,
        entity_type: EntityType,
        entity_id: i64,
        tag_names: &[String],
    ) -> Result<(), DatabaseError> {
        let tag_ids: Vec<i64> = tag_names
            .iter()
            .map(|name| Self::get_or_create(db, name).map(|t| t.id))
            .collect::<Result<Vec<_>, _>>()?;

        Self::set_tags_for_entity(db, entity_type, entity_id, &tag_ids)
    }
}

// --- Taggable implementations for all entities ------------------------------

use crate::models::goal::Goal;
use crate::models::kudo::Kudo;
use crate::models::til::Til;
use crate::models::todo::Todo;

impl Taggable for Todo {
    fn entity_id(&self) -> i64 { self.id }
    fn entity_type() -> EntityType { EntityType::Todo }
    fn set_tags(&mut self, tags: Vec<String>) { self.tags = tags; }
}

impl Taggable for Goal {
    fn entity_id(&self) -> i64 { self.id }
    fn entity_type() -> EntityType { EntityType::Goal }
    fn set_tags(&mut self, tags: Vec<String>) { self.tags = tags; }
}

impl Taggable for Kudo {
    fn entity_id(&self) -> i64 { self.id }
    fn entity_type() -> EntityType { EntityType::Kudo }
    fn set_tags(&mut self, tags: Vec<String>) { self.tags = tags; }
}

impl Taggable for Til {
    fn entity_id(&self) -> i64 { self.id }
    fn entity_type() -> EntityType { EntityType::Til }
    fn set_tags(&mut self, tags: Vec<String>) { self.tags = tags; }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::open_in_memory().unwrap()
    }

    #[test]
    fn create_tag() {
        let db = test_db();
        let tag = TagRepository::create(&db, "backend").unwrap();
        assert_eq!(tag.name, "backend");
    }

    #[test]
    fn create_duplicate_fails() {
        let db = test_db();
        TagRepository::create(&db, "backend").unwrap();
        assert!(TagRepository::create(&db, "backend").is_err());
    }

    #[test]
    fn get_or_create_returns_existing() {
        let db = test_db();
        let first = TagRepository::get_or_create(&db, "backend").unwrap();
        let second = TagRepository::get_or_create(&db, "backend").unwrap();
        assert_eq!(first.id, second.id);
    }

    #[test]
    fn get_or_create_creates_new() {
        let db = test_db();
        let tag = TagRepository::get_or_create(&db, "frontend").unwrap();
        assert_eq!(tag.name, "frontend");
    }

    #[test]
    fn list_with_usage_counts() {
        let db = test_db();
        let t1 = TagRepository::get_or_create(&db, "backend").unwrap();
        let t2 = TagRepository::get_or_create(&db, "frontend").unwrap();

        // Create a todo and tag it with "backend".
        db.conn()
            .execute(
                "INSERT INTO todos (id, title, status, priority, created_at, updated_at)
                 VALUES (1, 'todo', 'pending', 'medium', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO todo_tags (todo_id, tag_id) VALUES (1, ?1)",
                params![t1.id],
            )
            .unwrap();

        let list = TagRepository::list(&db).unwrap();
        assert_eq!(list.len(), 2);

        let backend = list.iter().find(|t| t.tag.name == "backend").unwrap();
        assert_eq!(backend.usage_count, 1);

        let frontend = list.iter().find(|t| t.tag.name == "frontend").unwrap();
        assert_eq!(frontend.usage_count, 0);

        // Verify they're in the list regardless of usage.
        assert_eq!(list[0].tag.id, t1.id); // "backend" < "frontend" alphabetically
        assert_eq!(list[1].tag.id, t2.id);
    }

    #[test]
    fn delete_tag_cascades() {
        let db = test_db();
        let tag = TagRepository::create(&db, "backend").unwrap();

        // Link to a todo.
        db.conn()
            .execute(
                "INSERT INTO todos (id, title, status, priority, created_at, updated_at)
                 VALUES (1, 'todo', 'pending', 'medium', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO todo_tags (todo_id, tag_id) VALUES (1, ?1)",
                params![tag.id],
            )
            .unwrap();

        TagRepository::delete(&db, tag.id).unwrap();

        // Junction row should be cascaded.
        let count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM todo_tags", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);

        // Tag itself gone.
        let list = TagRepository::list(&db).unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn set_and_get_tags_for_entity() {
        let db = test_db();

        // Create a todo.
        db.conn()
            .execute(
                "INSERT INTO todos (id, title, status, priority, created_at, updated_at)
                 VALUES (1, 'todo', 'pending', 'medium', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();

        let t1 = TagRepository::get_or_create(&db, "backend").unwrap();
        let t2 = TagRepository::get_or_create(&db, "rust").unwrap();

        TagRepository::set_tags_for_entity(&db, EntityType::Todo, 1, &[t1.id, t2.id]).unwrap();

        let tags = TagRepository::get_tags_for_entity(&db, EntityType::Todo, 1).unwrap();
        assert_eq!(tags, vec!["backend", "rust"]);
    }

    #[test]
    fn set_tags_replaces_existing() {
        let db = test_db();

        db.conn()
            .execute(
                "INSERT INTO todos (id, title, status, priority, created_at, updated_at)
                 VALUES (1, 'todo', 'pending', 'medium', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();

        let t1 = TagRepository::get_or_create(&db, "backend").unwrap();
        let t2 = TagRepository::get_or_create(&db, "frontend").unwrap();

        // Set initial tags.
        TagRepository::set_tags_for_entity(&db, EntityType::Todo, 1, &[t1.id]).unwrap();
        let tags = TagRepository::get_tags_for_entity(&db, EntityType::Todo, 1).unwrap();
        assert_eq!(tags, vec!["backend"]);

        // Replace with different tags.
        TagRepository::set_tags_for_entity(&db, EntityType::Todo, 1, &[t2.id]).unwrap();
        let tags = TagRepository::get_tags_for_entity(&db, EntityType::Todo, 1).unwrap();
        assert_eq!(tags, vec!["frontend"]);
    }

    #[test]
    fn set_tags_by_name() {
        let db = test_db();

        db.conn()
            .execute(
                "INSERT INTO goals (id, title, status, created_at, updated_at)
                 VALUES (1, 'goal', 'not-started', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();

        TagRepository::set_tags_by_name(
            &db,
            EntityType::Goal,
            1,
            &["backend".to_string(), "q1".to_string()],
        )
        .unwrap();

        let tags = TagRepository::get_tags_for_entity(&db, EntityType::Goal, 1).unwrap();
        assert_eq!(tags, vec!["backend", "q1"]);

        // Tags should exist in the tags table now.
        let all = TagRepository::list(&db).unwrap();
        assert_eq!(all.len(), 2);
    }
}
