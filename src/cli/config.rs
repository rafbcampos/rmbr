use clap::Subcommand;

use crate::db::config::ConfigRepository;
use crate::db::{Database, DatabaseError};

#[derive(Subcommand)]
pub enum ConfigAction {
    /// Get a config value
    Get { key: String },
    /// Set a config value
    Set { key: String, value: String },
    /// List all config values
    List,
    /// Delete a config key
    Delete { key: String },
}

pub fn handle(action: ConfigAction, db: &Database) -> Result<(), DatabaseError> {
    match action {
        ConfigAction::Get { key } => {
            match ConfigRepository::get(db, &key)? {
                Some(config) => println!("{} = {}", config.key, config.value),
                None => eprintln!("Key '{key}' not set."),
            }
            Ok(())
        }
        ConfigAction::Set { key, value } => {
            ConfigRepository::set(db, &key, &value)?;
            println!("{key} = {value}");
            Ok(())
        }
        ConfigAction::List => {
            let configs = ConfigRepository::list(db)?;
            if configs.is_empty() {
                println!("No config values set.");
            } else {
                for c in &configs {
                    println!("  {} = {}", c.key, c.value);
                }
            }
            Ok(())
        }
        ConfigAction::Delete { key } => {
            ConfigRepository::delete(db, &key)?;
            println!("Key '{key}' deleted.");
            Ok(())
        }
    }
}
