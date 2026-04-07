use clap::Subcommand;

use crate::db::tag::TagRepository;
use crate::db::{Database, DatabaseError};

#[derive(Subcommand)]
pub enum TagAction {
    /// List all tags with usage counts
    List,
    /// Add a new tag
    Add {
        /// Tag name
        name: String,
    },
    /// Delete a tag (cascades from all entities)
    Delete {
        /// Tag ID
        id: i64,
    },
}

pub fn handle(action: TagAction, db: &Database) -> Result<(), DatabaseError> {
    match action {
        TagAction::List => {
            let tags = TagRepository::list(db)?;
            if tags.is_empty() {
                println!("No tags found.");
            } else {
                for t in &tags {
                    println!("  #{:<4} {:20} ({} uses)", t.tag.id, t.tag.name, t.usage_count);
                }
                println!("\n{} tag(s)", tags.len());
            }
            Ok(())
        }
        TagAction::Add { name } => {
            let tag = TagRepository::create(db, &name)?;
            println!("Tag #{} '{}' created.", tag.id, tag.name);
            Ok(())
        }
        TagAction::Delete { id } => {
            TagRepository::delete(db, id)?;
            println!("Tag #{id} deleted.");
            Ok(())
        }
    }
}
