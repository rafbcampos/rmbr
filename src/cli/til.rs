use clap::Subcommand;

use super::{apply_tags, format_deleted, format_tags, parse_date_opt, print_list};
use crate::db::repository::CrudRepository;
use crate::db::tag::EntityType;
use crate::db::til::{CreateTil, TilFilter, TilRepository, UpdateTil};
use crate::db::{Database, DatabaseError};
use crate::models::til::{Til, TilCategory};

#[derive(Subcommand)]
pub enum TilAction {
    /// List TILs
    List {
        #[arg(long)]
        category: Option<TilCategory>,
        #[arg(long)]
        after: Option<String>,
        #[arg(long)]
        before: Option<String>,
        #[arg(long)]
        tag: Option<String>,
        #[arg(long)]
        deleted: bool,
    },
    /// Add a new TIL
    Add {
        title: String,
        #[arg(long, short)]
        body: String,
        #[arg(long, short)]
        source: Option<String>,
        #[arg(long, short, default_value = "technical")]
        category: TilCategory,
        #[arg(long)]
        tag: Vec<String>,
    },
    /// Edit an existing TIL
    Edit {
        id: i64,
        #[arg(long)]
        title: Option<String>,
        #[arg(long, short)]
        body: Option<String>,
        #[arg(long, short)]
        source: Option<String>,
        #[arg(long, short)]
        category: Option<TilCategory>,
        /// Tags (replaces existing, repeatable)
        #[arg(long)]
        tag: Vec<String>,
    },
    /// Show TIL details
    Show { id: i64 },
    /// Soft-delete a TIL
    Delete { id: i64 },
    /// Restore a soft-deleted TIL
    Restore { id: i64 },
    /// Permanently remove a TIL
    Purge {
        id: Option<i64>,
        #[arg(long)]
        all: bool,
        #[arg(long)]
        older_than: Option<String>,
    },
}

pub fn handle(action: TilAction, db: &Database) -> Result<(), DatabaseError> {
    match action {
        TilAction::Add { title, body, source, category, tag } => {
            let title = super::require(&title, "title")?;
            let body = super::require(&body, "body")?;
            let til = TilRepository::create(db, CreateTil {
                title, body, source, category,
            })?;
            apply_tags(db, EntityType::Til, til.id, &tag)?;
            let til = TilRepository::get_by_id(db, til.id)?
                .ok_or(DatabaseError::NotFound { entity: "til", id: til.id })?;
            print_til(&til);
            println!("TIL #{} created.", til.id);
            Ok(())
        }
        TilAction::List { category, after, before, tag, deleted } => {
            let filter = TilFilter {
                category,
                date_after: parse_date_opt(&after)?,
                date_before: parse_date_opt(&before)?,
                tag, include_deleted: deleted,
            };
            let tils = TilRepository::list(db, filter)?;
            print_list(&tils, "TIL", print_til_row);
            Ok(())
        }
        TilAction::Show { id } => {
            let til = TilRepository::get_by_id(db, id)?
                .ok_or(DatabaseError::NotFound { entity: "til", id })?;
            print_til(&til);
            Ok(())
        }
        TilAction::Edit { id, title, body, source, category, tag } => {
            TilRepository::update(db, id, UpdateTil {
                title, body,
                source: source.map(Some),
                category,
            })?;
            if !tag.is_empty() {
                apply_tags(db, EntityType::Til, id, &tag)?;
            }
            let til = TilRepository::get_by_id(db, id)?
                .ok_or(DatabaseError::NotFound { entity: "til", id })?;
            print_til(&til);
            println!("TIL #{id} updated.");
            Ok(())
        }
        TilAction::Delete { id } => super::soft_delete::<TilRepository>(db, id, "TIL"),
        TilAction::Restore { id } => super::restore::<TilRepository>(db, id, "TIL"),
        TilAction::Purge { id, all, older_than } => super::handle_purge::<TilRepository>(db, id, all, &older_than, "tils", "TIL"),
    }
}

fn print_til(til: &Til) {
    println!("#{} {}", til.id, til.title);
    println!("  Category: {}", til.category);
    println!("  {}", til.body);
    if let Some(ref src) = til.source { println!("  Source: {src}"); }
    if !til.tags.is_empty() { println!("  Tags: {}", til.tags.join(", ")); }
    if til.deleted_at.is_some() { println!("  [DELETED]"); }
}

fn print_til_row(til: &Til) {
    println!("  #{:<4} {:10} {}{}{}",
        til.id, til.category, til.title,
        format_tags(&til.tags), format_deleted(&til.deleted_at),
    );
}
