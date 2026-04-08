pub mod config;
pub mod goal;
pub mod kudo;
pub mod tag;
pub mod til;
pub mod todo;

use chrono::{DateTime, NaiveDate, Utc};
use clap::{Parser, Subcommand};

use crate::db::repository::CrudRepository;
use crate::db::tag::{EntityType, TagRepository};
use crate::db::{Database, DatabaseError};

// --- Shared helpers for CLI handlers ----------------------------------------

/// Parses a date string into a NaiveDate. Accepts YYYY-MM-DD or YYYYMMDD.
pub fn parse_date(s: &str) -> Result<NaiveDate, DatabaseError> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .or_else(|_| NaiveDate::parse_from_str(s, "%Y%m%d"))
        .map_err(|_| DatabaseError::InvalidInput {
            message: format!("invalid date '{s}', expected YYYY-MM-DD or YYYYMMDD"),
        })
}

/// Parses an optional date string.
pub fn parse_date_opt(s: &Option<String>) -> Result<Option<NaiveDate>, DatabaseError> {
    s.as_deref().map(parse_date).transpose()
}

/// Soft-deletes an entity and prints confirmation.
pub fn soft_delete<R: CrudRepository>(db: &Database, id: i64, label: &str) -> Result<(), DatabaseError> {
    R::soft_delete(db, id)?;
    println!("{label} #{id} deleted.");
    Ok(())
}

/// Restores a soft-deleted entity and prints confirmation.
pub fn restore<R: CrudRepository>(db: &Database, id: i64, label: &str) -> Result<(), DatabaseError> {
    R::restore(db, id)?;
    println!("{label} #{id} restored.");
    Ok(())
}


/// Prints a list of items with a row-printing function, or "No {label}s found."
pub fn print_list<T>(items: &[T], label: &str, print_row: fn(&T)) {
    if items.is_empty() {
        println!("No {label}s found.");
    } else {
        for item in items {
            print_row(item);
        }
        println!("\n{} {label}(s)", items.len());
    }
}

/// Sets tags on a newly created entity. No-op if tags is empty.
pub fn apply_tags(db: &Database, entity_type: EntityType, id: i64, tags: &[String]) -> Result<(), DatabaseError> {
    if !tags.is_empty() {
        TagRepository::set_tags_by_name(db, entity_type, id, tags)?;
    }
    Ok(())
}

/// Formats tags as " [tag1, tag2]" or empty string.
pub fn format_tags(tags: &[String]) -> String {
    if tags.is_empty() {
        String::new()
    } else {
        format!(" [{}]", tags.join(", "))
    }
}

/// Returns " [DEL]" if deleted, empty string otherwise.
pub fn format_deleted(deleted_at: &Option<DateTime<Utc>>) -> &'static str {
    if deleted_at.is_some() { " [DEL]" } else { "" }
}

/// Parses a duration like "90d" into days.
pub fn parse_days(s: &str) -> Result<i64, DatabaseError> {
    let s = s.trim().to_lowercase();
    if let Some(num_str) = s.strip_suffix('d') {
        num_str.parse().map_err(|_| DatabaseError::InvalidInput {
            message: format!("invalid duration '{s}', expected e.g. '90d'"),
        })
    } else {
        Err(DatabaseError::InvalidInput {
            message: format!("invalid duration '{s}', expected e.g. '90d'"),
        })
    }
}

/// Handles purge logic: single ID or bulk --all with optional --older-than.
pub fn handle_purge<R: CrudRepository>(
    db: &Database,
    id: Option<i64>,
    all: bool,
    older_than: &Option<String>,
    table: &str,
    label: &str,
) -> Result<(), DatabaseError> {
    if all {
        let days = older_than
            .as_deref()
            .map(parse_days)
            .transpose()?;
        let count = db.purge_deleted(table, days)?;
        println!("{count} {label}(s) permanently removed.");
        Ok(())
    } else if let Some(id) = id {
        R::purge(db, id)?;
        println!("{label} #{id} permanently removed.");
        Ok(())
    } else {
        Err(DatabaseError::InvalidInput {
            message: format!("provide an ID or use --all to purge deleted {label}s"),
        })
    }
}

/// Validates that a required string field is not empty.
/// Returns the trimmed value or an error with the field name.
pub fn require(value: &str, field: &str) -> Result<String, DatabaseError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(DatabaseError::InvalidInput {
            message: format!("{field} cannot be empty"),
        });
    }
    Ok(trimmed.to_string())
}

/// Parses a comma-separated tag string into a Vec of trimmed, non-empty tag names.
pub fn parse_comma_tags(input: &str) -> Vec<String> {
    input
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn parse_date_dashed_format() {
        let result = parse_date("2026-04-08");
        assert_eq!(result.unwrap(), NaiveDate::from_ymd_opt(2026, 4, 8).unwrap());
    }

    #[test]
    fn parse_date_compact_format() {
        let result = parse_date("20260408");
        assert_eq!(result.unwrap(), NaiveDate::from_ymd_opt(2026, 4, 8).unwrap());
    }

    #[test]
    fn parse_date_invalid_shows_both_formats() {
        let result = parse_date("bad-date");
        let err = result.unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("YYYY-MM-DD"), "error should mention dashed format: {msg}");
        assert!(msg.contains("YYYYMMDD"), "error should mention compact format: {msg}");
    }

    #[test]
    fn parse_date_opt_none_returns_none() {
        assert_eq!(parse_date_opt(&None).unwrap(), None);
    }

    #[test]
    fn parse_date_opt_some_valid() {
        let result = parse_date_opt(&Some("20260408".to_string()));
        assert_eq!(result.unwrap(), Some(NaiveDate::from_ymd_opt(2026, 4, 8).unwrap()));
    }
}

#[derive(Parser)]
#[command(
    name = "rmbr",
    about = "Your second brain at work — track todos, goals, kudos, and learnings locally.",
    version,
    after_help = "EXAMPLES:
  rmbr                              Open TUI dashboard
  rmbr todo add \"Fix bug\" -p high   Add a todo via CLI
  rmbr todo                         Open todo TUI
  rmbr todo start 1                 Start working on todo #1
  rmbr goal add \"Ship X\" --situation \"Team needs it\"
  rmbr kudo add \"Great work\" --from Alice --goal 1
  rmbr til add \"Lifetimes\" -b \"Refs must be valid\" -c technical
  rmbr standup                      Generate standup report
  rmbr review --half H1             Generate performance review
  rmbr config set standup.days mon,wed,fri"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Command>,
}

#[derive(Subcommand)]
pub enum Command {
    /// Manage todos (open TUI if no subcommand)
    Todo {
        #[command(subcommand)]
        action: Option<todo::TodoAction>,
    },
    /// Manage goals — STAR framework (open TUI if no subcommand)
    Goal {
        #[command(subcommand)]
        action: Option<goal::GoalAction>,
    },
    /// Manage kudos given and received (open TUI if no subcommand)
    Kudo {
        #[command(subcommand)]
        action: Option<kudo::KudoAction>,
    },
    /// Manage TILs — Today I Learned (open TUI if no subcommand)
    Til {
        #[command(subcommand)]
        action: Option<til::TilAction>,
    },
    /// Manage tags
    Tag {
        #[command(subcommand)]
        action: tag::TagAction,
    },
    /// Manage configuration
    Config {
        #[command(subcommand)]
        action: config::ConfigAction,
    },
    /// Generate standup report (markdown to stdout)
    Standup {
        /// Show items since this date (YYYY-MM-DD)
        #[arg(long)]
        since: Option<String>,
    },
    /// Generate retrospective report (markdown to stdout)
    Retro {
        /// Show items since this date (YYYY-MM-DD)
        #[arg(long)]
        since: Option<String>,
        /// Show items from the last N period (e.g., "2w", "1m")
        #[arg(long)]
        last: Option<String>,
    },
    /// Generate performance review report (markdown to stdout)
    Review {
        /// Half-year period (H1 or H2)
        #[arg(long)]
        half: Option<String>,
        /// Show items since this date (YYYY-MM-DD)
        #[arg(long)]
        since: Option<String>,
    },
}
