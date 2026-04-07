use chrono::{NaiveDate, Utc};
use rusqlite::{params, OptionalExtension, Row};

use super::parse_enum_column;
use super::query::QueryBuilder;
use super::repository::CrudRepository;
use super::tag::{populate_tags, populate_tags_bulk};
use super::{Database, DatabaseError};
use crate::models::til::{Til, TilCategory};

pub struct TilRepository;

// --- Input / filter types ---------------------------------------------------

pub struct CreateTil {
    pub title: String,
    pub body: String,
    pub source: Option<String>,
    pub category: TilCategory,
}

pub struct UpdateTil {
    pub title: Option<String>,
    pub body: Option<String>,
    pub source: Option<Option<String>>,
    pub category: Option<TilCategory>,
}

#[derive(Default)]
pub struct TilFilter {
    pub category: Option<TilCategory>,
    pub date_after: Option<NaiveDate>,
    pub date_before: Option<NaiveDate>,
    pub tag: Option<String>,
    pub include_deleted: bool,
}

// --- Row mapping ------------------------------------------------------------

fn row_to_til(row: &Row<'_>) -> Result<Til, rusqlite::Error> {
    Ok(Til {
        id: row.get("id")?,
        title: row.get("title")?,
        body: row.get("body")?,
        source: row.get("source")?,
        category: parse_enum_column(&row.get::<_, String>("category")?)?,
        tags: Vec::new(),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

// --- CrudRepository impl ----------------------------------------------------

impl CrudRepository for TilRepository {
    type Entity = Til;
    type CreateInput = CreateTil;
    type UpdateInput = UpdateTil;
    type Filter = TilFilter;

    fn create(db: &Database, input: CreateTil) -> Result<Til, DatabaseError> {
        let now = Utc::now();
        db.conn().execute(
            "INSERT INTO tils (title, body, source, category, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![input.title, input.body, input.source, input.category.to_string(), now, now],
        )?;

        let id = db.conn().last_insert_rowid();
        Self::get_by_id(db, id)?.ok_or(DatabaseError::NotFound { entity: "til", id })
    }

    fn get_by_id(db: &Database, id: i64) -> Result<Option<Til>, DatabaseError> {
        let mut stmt = db.conn().prepare("SELECT * FROM tils WHERE id = ?1")?;
        let mut til = stmt.query_row(params![id], row_to_til).optional()?;

        if let Some(ref mut t) = til {
            populate_tags(db, t)?;
        }
        Ok(til)
    }

    fn list(db: &Database, filter: TilFilter) -> Result<Vec<Til>, DatabaseError> {
        let mut qb = QueryBuilder::new("SELECT DISTINCT ti.* FROM tils ti");

        if let Some(ref tag) = filter.tag {
            qb.join("JOIN til_tags tt ON tt.til_id = ti.id")
              .join("JOIN tags tg ON tg.id = tt.tag_id")
              .filter("tg.name = {}", Box::new(tag.clone()));
        }
        if !filter.include_deleted {
            qb.filter_raw("ti.deleted_at IS NULL");
        }
        if let Some(category) = filter.category {
            qb.filter("ti.category = {}", Box::new(category.to_string()));
        }
        if let Some(date_after) = filter.date_after {
            qb.filter("date(ti.created_at) >= {}", Box::new(date_after));
        }
        if let Some(date_before) = filter.date_before {
            qb.filter("date(ti.created_at) <= {}", Box::new(date_before));
        }
        qb.order_by("ti.created_at DESC");

        let mut stmt = db.conn().prepare(&qb.build())?;
        let mut tils: Vec<Til> = stmt
            .query_map(qb.params().as_slice(), row_to_til)?
            .collect::<Result<Vec<_>, _>>()?;

        populate_tags_bulk(db, &mut tils)?;
        Ok(tils)
    }

    fn update(db: &Database, id: i64, input: UpdateTil) -> Result<Til, DatabaseError> {
        let existing = Self::get_by_id(db, id)?
            .ok_or(DatabaseError::NotFound { entity: "til", id })?;

        let title = input.title.unwrap_or(existing.title);
        let body = input.body.unwrap_or(existing.body);
        let source = input.source.unwrap_or(existing.source);
        let category = input.category.unwrap_or(existing.category);
        let now = Utc::now();

        db.conn().execute(
            "UPDATE tils SET title = ?1, body = ?2, source = ?3, category = ?4, updated_at = ?5
             WHERE id = ?6",
            params![title, body, source, category.to_string(), now, id],
        )?;

        Self::get_by_id(db, id)?.ok_or(DatabaseError::NotFound { entity: "til", id })
    }

    fn soft_delete(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.soft_delete_row("tils", "til", id)
    }

    fn restore(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.restore_row("tils", "til", id)
    }

    fn purge(db: &Database, id: i64) -> Result<(), DatabaseError> {
        db.purge_row("tils", "til", id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::til::TilCategory;

    fn test_db() -> Database {
        Database::open_in_memory().unwrap()
    }

    fn create_default_til(db: &Database, title: &str) -> Til {
        TilRepository::create(
            db,
            CreateTil {
                title: title.to_string(),
                body: "Learned something".to_string(),
                source: None,
                category: TilCategory::Technical,
            },
        )
        .unwrap()
    }

    #[test]
    fn create_and_get_by_id() {
        let db = test_db();
        let til = TilRepository::create(
            &db,
            CreateTil {
                title: "Rust lifetimes".to_string(),
                body: "Lifetimes are about references...".to_string(),
                source: Some("Rust Book Ch10".to_string()),
                category: TilCategory::Technical,
            },
        )
        .unwrap();

        assert_eq!(til.title, "Rust lifetimes");
        assert_eq!(til.body, "Lifetimes are about references...");
        assert_eq!(til.source.as_deref(), Some("Rust Book Ch10"));
        assert_eq!(til.category, TilCategory::Technical);

        let fetched = TilRepository::get_by_id(&db, til.id).unwrap().unwrap();
        assert_eq!(fetched.id, til.id);
    }

    #[test]
    fn list_excludes_deleted_by_default() {
        let db = test_db();
        let t1 = create_default_til(&db, "Active");
        let t2 = create_default_til(&db, "Deleted");
        TilRepository::soft_delete(&db, t2.id).unwrap();

        let list = TilRepository::list(&db, TilFilter::default()).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, t1.id);
    }

    #[test]
    fn filter_by_category() {
        let db = test_db();
        create_default_til(&db, "Technical");
        TilRepository::create(
            &db,
            CreateTil {
                title: "Process".to_string(),
                body: "Learned about process".to_string(),
                source: None,
                category: TilCategory::Process,
            },
        )
        .unwrap();

        let list = TilRepository::list(
            &db,
            TilFilter { category: Some(TilCategory::Process), ..Default::default() },
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "Process");
    }

    #[test]
    fn update_fields() {
        let db = test_db();
        let til = create_default_til(&db, "Original");

        let updated = TilRepository::update(
            &db,
            til.id,
            UpdateTil {
                title: Some("Updated".to_string()),
                body: Some("New body".to_string()),
                source: Some(Some("New source".to_string())),
                category: Some(TilCategory::Domain),
            },
        )
        .unwrap();

        assert_eq!(updated.title, "Updated");
        assert_eq!(updated.body, "New body");
        assert_eq!(updated.source.as_deref(), Some("New source"));
        assert_eq!(updated.category, TilCategory::Domain);
    }

    #[test]
    fn soft_delete_and_restore() {
        let db = test_db();
        let til = create_default_til(&db, "TIL");

        TilRepository::soft_delete(&db, til.id).unwrap();
        assert!(TilRepository::get_by_id(&db, til.id).unwrap().unwrap().deleted_at.is_some());

        TilRepository::restore(&db, til.id).unwrap();
        assert!(TilRepository::get_by_id(&db, til.id).unwrap().unwrap().deleted_at.is_none());
    }

    #[test]
    fn purge_removes_permanently() {
        let db = test_db();
        let til = create_default_til(&db, "TIL");
        TilRepository::purge(&db, til.id).unwrap();
        assert!(TilRepository::get_by_id(&db, til.id).unwrap().is_none());
    }
}
