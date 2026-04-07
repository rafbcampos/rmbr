use chrono::Local;
use clap::Subcommand;

use super::{apply_tags, format_deleted, parse_date, parse_date_opt, print_list};
use crate::db::kudo::{CreateKudo, KudoFilter, KudoRepository, UpdateKudo};
use crate::db::repository::CrudRepository;
use crate::db::tag::EntityType;
use crate::db::{Database, DatabaseError};
use crate::models::kudo::Kudo;

#[derive(Subcommand)]
pub enum KudoAction {
    /// List kudos
    List {
        #[arg(long)]
        from: Option<String>,
        #[arg(long)]
        to: Option<String>,
        #[arg(long)]
        after: Option<String>,
        #[arg(long)]
        before: Option<String>,
        #[arg(long)]
        tag: Option<String>,
        #[arg(long)]
        deleted: bool,
    },
    /// Add a new kudo
    Add {
        title: String,
        #[arg(long, short)]
        description: Option<String>,
        #[arg(long)]
        from: Option<String>,
        #[arg(long)]
        from_slack: Option<String>,
        #[arg(long)]
        to: Option<String>,
        #[arg(long)]
        to_slack: Option<String>,
        #[arg(long)]
        date: Option<String>,
        #[arg(long)]
        tag: Vec<String>,
        #[arg(long)]
        goal: Vec<i64>,
    },
    /// Edit an existing kudo
    Edit {
        id: i64,
        #[arg(long)]
        title: Option<String>,
        #[arg(long, short)]
        description: Option<String>,
        #[arg(long)]
        from: Option<String>,
        #[arg(long)]
        from_slack: Option<String>,
        #[arg(long)]
        to: Option<String>,
        #[arg(long)]
        to_slack: Option<String>,
        #[arg(long)]
        date: Option<String>,
        /// Tags (replaces existing, repeatable)
        #[arg(long)]
        tag: Vec<String>,
    },
    /// Show kudo details
    Show { id: i64 },
    /// Link a goal to this kudo
    Link { id: i64, #[arg(long)] goal: i64 },
    /// Unlink a goal from this kudo
    Unlink { id: i64, #[arg(long)] goal: i64 },
    /// Soft-delete a kudo
    Delete { id: i64 },
    /// Restore a soft-deleted kudo
    Restore { id: i64 },
    /// Permanently remove a kudo
    Purge {
        id: Option<i64>,
        #[arg(long)]
        all: bool,
        #[arg(long)]
        older_than: Option<String>,
    },
}

pub fn handle(action: KudoAction, db: &Database) -> Result<(), DatabaseError> {
    match action {
        KudoAction::Add { title, description, from, from_slack, to, to_slack, date, tag, goal } => {
            let title = super::require(&title, "title")?;
            let kudo_date = match date {
                Some(ref d) => parse_date(d)?,
                None => Local::now().date_naive(),
            };
            let kudo = KudoRepository::create(db, CreateKudo {
                title, description,
                from_name: from, from_slack,
                to_name: to, to_slack,
                date: kudo_date,
            })?;
            apply_tags(db, EntityType::Kudo, kudo.id, &tag)?;
            for goal_id in &goal {
                KudoRepository::link_goal(db, kudo.id, *goal_id)?;
            }
            let kudo = KudoRepository::get_by_id(db, kudo.id)?
                .ok_or(DatabaseError::NotFound { entity: "kudo", id: kudo.id })?;
            print_kudo(&kudo);
            println!("Kudo #{} created.", kudo.id);
            Ok(())
        }
        KudoAction::List { from, to, after, before, tag, deleted } => {
            let filter = KudoFilter {
                from_name: from, to_name: to,
                date_after: parse_date_opt(&after)?,
                date_before: parse_date_opt(&before)?,
                tag, include_deleted: deleted,
            };
            let kudos = KudoRepository::list(db, filter)?;
            print_list(&kudos, "kudo", print_kudo_row);
            Ok(())
        }
        KudoAction::Show { id } => {
            let kudo = KudoRepository::get_by_id(db, id)?
                .ok_or(DatabaseError::NotFound { entity: "kudo", id })?;
            print_kudo(&kudo);
            let goals = KudoRepository::get_linked_goals(db, id)?;
            if !goals.is_empty() {
                println!("\nLinked goals:");
                for g in &goals {
                    println!("  #{} [{}] {}", g.id, g.status, g.title);
                }
            }
            Ok(())
        }
        KudoAction::Edit { id, title, description, from, from_slack, to, to_slack, date, tag } => {
            let kudo_date = date.as_deref().map(parse_date).transpose()?;
            KudoRepository::update(db, id, UpdateKudo {
                title,
                description: description.map(Some),
                from_name: from.map(Some),
                from_slack: from_slack.map(Some),
                to_name: to.map(Some),
                to_slack: to_slack.map(Some),
                date: kudo_date,
            })?;
            if !tag.is_empty() {
                apply_tags(db, EntityType::Kudo, id, &tag)?;
            }
            let kudo = KudoRepository::get_by_id(db, id)?
                .ok_or(DatabaseError::NotFound { entity: "kudo", id })?;
            print_kudo(&kudo);
            println!("Kudo #{id} updated.");
            Ok(())
        }
        KudoAction::Link { id, goal } => {
            KudoRepository::link_goal(db, id, goal)?;
            println!("Goal #{goal} linked to Kudo #{id}.");
            Ok(())
        }
        KudoAction::Unlink { id, goal } => {
            KudoRepository::unlink_goal(db, id, goal)?;
            println!("Goal #{goal} unlinked from Kudo #{id}.");
            Ok(())
        }
        KudoAction::Delete { id } => super::soft_delete::<KudoRepository>(db, id, "Kudo"),
        KudoAction::Restore { id } => super::restore::<KudoRepository>(db, id, "Kudo"),
        KudoAction::Purge { id, all, older_than } => super::handle_purge::<KudoRepository>(db, id, all, &older_than, "kudos", "Kudo"),
    }
}

fn print_kudo(kudo: &Kudo) {
    println!("#{} {}", kudo.id, kudo.title);
    if let Some(ref desc) = kudo.description { println!("  Description: {desc}"); }
    let from = format_person(&kudo.from_name, &kudo.from_slack);
    let to = format_person(&kudo.to_name, &kudo.to_slack);
    if !from.is_empty() { println!("  From: {from}"); }
    if !to.is_empty() { println!("  To: {to}"); }
    println!("  Date: {}", kudo.date);
    if !kudo.tags.is_empty() { println!("  Tags: {}", kudo.tags.join(", ")); }
    if kudo.deleted_at.is_some() { println!("  [DELETED]"); }
}

fn print_kudo_row(kudo: &Kudo) {
    let from = kudo.from_name.as_deref().unwrap_or("?");
    let to = kudo.to_name.as_deref().unwrap_or("me");
    println!("  #{:<4} {} {} → {} {}{}",
        kudo.id, kudo.date, from, to, kudo.title, format_deleted(&kudo.deleted_at),
    );
}

fn format_person(name: &Option<String>, slack: &Option<String>) -> String {
    match (name, slack) {
        (Some(n), Some(s)) => format!("{n} ({s})"),
        (Some(n), None) => n.clone(),
        (None, Some(s)) => s.clone(),
        (None, None) => String::new(),
    }
}
