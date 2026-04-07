use chrono::{NaiveDate, Utc};
use rusqlite::{params, OptionalExtension, Row};

use super::goal::row_to_goal;
use super::query::QueryBuilder;
use super::repository::CrudRepository;
use super::tag::{populate_tags, populate_tags_bulk};
use super::{Database, DatabaseError};
use crate::models::goal::Goal;
use crate::models::kudo::Kudo;

pub struct KudoRepository;

// --- Input / filter types ---------------------------------------------------

pub struct CreateKudo {
    pub title: String,
    pub description: Option<String>,
    pub from_name: Option<String>,
    pub from_slack: Option<String>,
    pub to_name: Option<String>,
    pub to_slack: Option<String>,
    pub date: NaiveDate,
}

pub struct UpdateKudo {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub from_name: Option<Option<String>>,
    pub from_slack: Option<Option<String>>,
    pub to_name: Option<Option<String>>,
    pub to_slack: Option<Option<String>>,
    pub date: Option<NaiveDate>,
}

#[derive(Default)]
pub struct KudoFilter {
    pub from_name: Option<String>,
    pub to_name: Option<String>,
    pub date_after: Option<NaiveDate>,
    pub date_before: Option<NaiveDate>,
    pub tag: Option<String>,
    pub include_deleted: bool,
}

// --- Row mapping ------------------------------------------------------------

fn row_to_kudo(row: &Row<'_>) -> Result<Kudo, rusqlite::Error> {
    Ok(Kudo {
        id: row.get("id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        from_name: row.get("from_name")?,
        from_slack: row.get("from_slack")?,
        to_name: row.get("to_name")?,
        to_slack: row.get("to_slack")?,
        date: row.get("date")?,
        tags: Vec::new(),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

// --- CrudRepository impl ----------------------------------------------------

impl CrudRepository for KudoRepository {
    type Entity = Kudo;
    type CreateInput = CreateKudo;
    type UpdateInput = UpdateKudo;
    type Filter = KudoFilter;

    fn create(db: &Database, input: CreateKudo) -> Result<Kudo, DatabaseError> {
        let now = Utc::now();
        db.conn().execute(
            "INSERT INTO kudos (title, description, from_name, from_slack, to_name, to_slack, date, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                input.title, input.description, input.from_name, input.from_slack,
                input.to_name, input.to_slack, input.date, now, now,
            ],
        )?;

        let id = db.conn().last_insert_rowid();
        Self::get_by_id(db, id)?.ok_or(DatabaseError::NotFound { entity: "kudo", id })
    }

    fn get_by_id(db: &Database, id: i64) -> Result<Option<Kudo>, DatabaseError> {
        let mut stmt = db.conn().prepare("SELECT * FROM kudos WHERE id = ?1")?;
        let mut kudo = stmt.query_row(params![id], row_to_kudo).optional()?;

        if let Some(ref mut k) = kudo {
            populate_tags(db, k)?;
        }
        Ok(kudo)
    }

    fn list(db: &Database, filter: KudoFilter) -> Result<Vec<Kudo>, DatabaseError> {
        let mut qb = QueryBuilder::new("SELECT DISTINCT k.* FROM kudos k");

        if let Some(ref tag) = filter.tag {
            qb.join("JOIN kudo_tags kt ON kt.kudo_id = k.id")
              .join("JOIN tags tg ON tg.id = kt.tag_id")
              .filter("tg.name = {}", Box::new(tag.clone()));
        }
        if !filter.include_deleted {
            qb.filter_raw("k.deleted_at IS NULL");
        }
        if let Some(ref from_name) = filter.from_name {
            qb.filter("k.from_name LIKE {}", Box::new(format!("%{from_name}%")));
        }
        if let Some(ref to_name) = filter.to_name {
            qb.filter("k.to_name LIKE {}", Box::new(format!("%{to_name}%")));
        }
        if let Some(date_after) = filter.date_after {
            qb.filter("k.date >= {}", Box::new(date_after));
        }
        if let Some(date_before) = filter.date_before {
            qb.filter("k.date <= {}", Box::new(date_before));
        }
        qb.order_by("k.date DESC, k.created_at DESC");

        let mut stmt = db.conn().prepare(&qb.build())?;
        let mut kudos: Vec<Kudo> = stmt
            .query_map(qb.params().as_slice(), row_to_kudo)?
            .collect::<Result<Vec<_>, _>>()?;

        populate_tags_bulk(db, &mut kudos)?;
        Ok(kudos)
    }

    fn update(db: &Database, id: i64, input: UpdateKudo) -> Result<Kudo, DatabaseError> {
        let existing = Self::get_by_id(db, id)?
            .ok_or(DatabaseError::NotFound { entity: "kudo", id })?;

        let title = input.title.unwrap_or(existing.title);
        let description = input.description.unwrap_or(existing.description);
        let from_name = input.from_name.unwrap_or(existing.from_name);
        let from_slack = input.from_slack.unwrap_or(existing.from_slack);
        let to_name = input.to_name.unwrap_or(existing.to_name);
        let to_slack = input.to_slack.unwrap_or(existing.to_slack);
        let date = input.date.unwrap_or(existing.date);
        let now = Utc::now();

        db.conn().execute(
            "UPDATE kudos SET title = ?1, description = ?2, from_name = ?3, from_slack = ?4,
             to_name = ?5, to_slack = ?6, date = ?7, updated_at = ?8 WHERE id = ?9",
            params![title, description, from_name, from_slack, to_name, to_slack, date, now, id],
        )?;

        Self::get_by_id(db, id)?.ok_or(DatabaseError::NotFound { entity: "kudo", id })
    }

    fn soft_delete(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.soft_delete_row("kudos", "kudo", id)
    }

    fn restore(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.restore_row("kudos", "kudo", id)
    }

    fn purge(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.purge_row("kudos", "kudo", id)
    }
}

// --- Kudo-specific: goal linking ---------------------------------------------

impl KudoRepository {
    pub fn link_goal(db: &Database, kudo_id: i64, goal_id: i64) -> Result<(), DatabaseError> {
        db.conn().execute(
            "INSERT OR IGNORE INTO kudo_goals (kudo_id, goal_id) VALUES (?1, ?2)",
            params![kudo_id, goal_id],
        )?;
        Ok(())
    }

    pub fn unlink_goal(db: &Database, kudo_id: i64, goal_id: i64) -> Result<(), DatabaseError> {
        db.conn().execute(
            "DELETE FROM kudo_goals WHERE kudo_id = ?1 AND goal_id = ?2",
            params![kudo_id, goal_id],
        )?;
        Ok(())
    }

    /// Returns linked goals with their tags populated.
    pub fn get_linked_goals(db: &Database, kudo_id: i64) -> Result<Vec<Goal>, DatabaseError> {
        let mut stmt = db.conn().prepare(
            "SELECT g.* FROM goals g
             JOIN kudo_goals kg ON kg.goal_id = g.id
             WHERE kg.kudo_id = ?1
             ORDER BY g.created_at DESC",
        )?;

        let mut goals: Vec<Goal> = stmt
            .query_map(params![kudo_id], row_to_goal)?
            .collect::<Result<Vec<_>, _>>()?;

        populate_tags_bulk(db, &mut goals)?;
        Ok(goals)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::goal::{CreateGoal, GoalRepository};
    use crate::db::tag::TagRepository;

    fn test_db() -> Database {
        Database::open_in_memory().unwrap()
    }

    fn create_default_kudo(db: &Database, title: &str) -> Kudo {
        KudoRepository::create(
            db,
            CreateKudo {
                title: title.to_string(),
                description: None,
                from_name: Some("Alice".to_string()),
                from_slack: Some("@alice".to_string()),
                to_name: None,
                to_slack: None,
                date: NaiveDate::from_ymd_opt(2026, 4, 1).unwrap(),
            },
        )
        .unwrap()
    }

    fn create_default_goal(db: &Database, title: &str) -> Goal {
        GoalRepository::create(
            db,
            CreateGoal {
                title: title.to_string(),
                situation: None, task: None, action: None, result: None, due_date: None,
            },
        )
        .unwrap()
    }

    #[test]
    fn create_and_get_by_id() {
        let db = test_db();
        let kudo = KudoRepository::create(
            &db,
            CreateKudo {
                title: "Great debugging".to_string(),
                description: Some("Helped fix prod outage".to_string()),
                from_name: Some("Alice".to_string()),
                from_slack: Some("@alice".to_string()),
                to_name: Some("me".to_string()),
                to_slack: None,
                date: NaiveDate::from_ymd_opt(2026, 4, 1).unwrap(),
            },
        )
        .unwrap();

        assert_eq!(kudo.title, "Great debugging");
        assert_eq!(kudo.from_name.as_deref(), Some("Alice"));
        assert_eq!(kudo.from_slack.as_deref(), Some("@alice"));
        assert_eq!(kudo.to_name.as_deref(), Some("me"));

        let fetched = KudoRepository::get_by_id(&db, kudo.id).unwrap().unwrap();
        assert_eq!(fetched.id, kudo.id);
    }

    #[test]
    fn list_excludes_deleted_by_default() {
        let db = test_db();
        let k1 = create_default_kudo(&db, "Active");
        let k2 = create_default_kudo(&db, "Deleted");
        KudoRepository::soft_delete(&db, k2.id).unwrap();

        let list = KudoRepository::list(&db, KudoFilter::default()).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, k1.id);
    }

    #[test]
    fn filter_by_from_name() {
        let db = test_db();
        create_default_kudo(&db, "From Alice");
        KudoRepository::create(
            &db,
            CreateKudo {
                title: "From Bob".to_string(),
                description: None,
                from_name: Some("Bob".to_string()),
                from_slack: None, to_name: None, to_slack: None,
                date: NaiveDate::from_ymd_opt(2026, 4, 1).unwrap(),
            },
        )
        .unwrap();

        let list = KudoRepository::list(
            &db,
            KudoFilter { from_name: Some("Bob".to_string()), ..Default::default() },
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "From Bob");
    }

    #[test]
    fn filter_by_date_range() {
        let db = test_db();
        KudoRepository::create(&db, CreateKudo {
            title: "January".to_string(), description: None, from_name: None, from_slack: None,
            to_name: None, to_slack: None, date: NaiveDate::from_ymd_opt(2026, 1, 15).unwrap(),
        }).unwrap();
        KudoRepository::create(&db, CreateKudo {
            title: "June".to_string(), description: None, from_name: None, from_slack: None,
            to_name: None, to_slack: None, date: NaiveDate::from_ymd_opt(2026, 6, 15).unwrap(),
        }).unwrap();

        let list = KudoRepository::list(
            &db,
            KudoFilter { date_after: Some(NaiveDate::from_ymd_opt(2026, 3, 1).unwrap()), ..Default::default() },
        ).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "June");
    }

    #[test]
    fn soft_delete_and_restore() {
        let db = test_db();
        let kudo = create_default_kudo(&db, "Kudo");

        KudoRepository::soft_delete(&db, kudo.id).unwrap();
        assert!(KudoRepository::get_by_id(&db, kudo.id).unwrap().unwrap().deleted_at.is_some());

        KudoRepository::restore(&db, kudo.id).unwrap();
        assert!(KudoRepository::get_by_id(&db, kudo.id).unwrap().unwrap().deleted_at.is_none());
    }

    #[test]
    fn purge_removes_permanently() {
        let db = test_db();
        let kudo = create_default_kudo(&db, "Kudo");
        KudoRepository::purge(&db, kudo.id).unwrap();
        assert!(KudoRepository::get_by_id(&db, kudo.id).unwrap().is_none());
    }

    #[test]
    fn link_and_unlink_goal() {
        let db = test_db();
        let kudo = create_default_kudo(&db, "Kudo");
        let goal = create_default_goal(&db, "Goal");

        KudoRepository::link_goal(&db, kudo.id, goal.id).unwrap();
        let linked = KudoRepository::get_linked_goals(&db, kudo.id).unwrap();
        assert_eq!(linked.len(), 1);
        assert_eq!(linked[0].id, goal.id);

        KudoRepository::unlink_goal(&db, kudo.id, goal.id).unwrap();
        assert!(KudoRepository::get_linked_goals(&db, kudo.id).unwrap().is_empty());
    }

    #[test]
    fn link_goal_is_idempotent() {
        let db = test_db();
        let kudo = create_default_kudo(&db, "Kudo");
        let goal = create_default_goal(&db, "Goal");

        KudoRepository::link_goal(&db, kudo.id, goal.id).unwrap();
        KudoRepository::link_goal(&db, kudo.id, goal.id).unwrap();
        assert_eq!(KudoRepository::get_linked_goals(&db, kudo.id).unwrap().len(), 1);
    }

    #[test]
    fn linked_goals_have_tags() {
        let db = test_db();
        let kudo = create_default_kudo(&db, "Kudo");
        let goal = create_default_goal(&db, "Goal");

        let tag = TagRepository::get_or_create(&db, "q1").unwrap();
        use crate::db::tag::EntityType;
        TagRepository::set_tags_for_entity(&db, EntityType::Goal, goal.id, &[tag.id]).unwrap();

        KudoRepository::link_goal(&db, kudo.id, goal.id).unwrap();
        let linked = KudoRepository::get_linked_goals(&db, kudo.id).unwrap();
        assert_eq!(linked[0].tags, vec!["q1".to_string()]);
    }

    #[test]
    fn update_fields() {
        let db = test_db();
        let kudo = create_default_kudo(&db, "Original");

        let updated = KudoRepository::update(
            &db,
            kudo.id,
            UpdateKudo {
                title: Some("Updated".to_string()),
                description: Some(Some("New desc".to_string())),
                from_name: None, from_slack: None,
                to_name: Some(Some("Bob".to_string())),
                to_slack: None, date: None,
            },
        )
        .unwrap();

        assert_eq!(updated.title, "Updated");
        assert_eq!(updated.description.as_deref(), Some("New desc"));
        assert_eq!(updated.from_name.as_deref(), Some("Alice")); // unchanged
        assert_eq!(updated.to_name.as_deref(), Some("Bob"));
    }
}
