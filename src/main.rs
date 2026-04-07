mod cli;
mod db;
mod models;
mod reports;
mod tui;

use std::process;

use clap::Parser;

use cli::{Cli, Command};
use db::Database;
use tui::views::dashboard::DashboardView;
use tui::views::goal::GoalView;
use tui::views::kudo::KudoView;
use tui::views::til::TilView;
use tui::views::todo::TodoView;

fn main() {
    let cli = Cli::parse();

    let db_path = match Database::default_path() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("Error: {e}");
            process::exit(1);
        }
    };

    let db = match Database::open(&db_path) {
        Ok(db) => db,
        Err(e) => {
            eprintln!("Error opening database: {e}");
            process::exit(1);
        }
    };

    if let Err(e) = run(cli, &db) {
        eprintln!("Error: {e}");
        process::exit(1);
    }
}

fn run(cli: Cli, db: &Database) -> Result<(), Box<dyn std::error::Error>> {
    match cli.command {
        None => Ok(tui::run(db, Box::new(DashboardView::new()))?),
        Some(command) => dispatch(command, db),
    }
}

fn open_tui(db: &Database, view: Box<dyn tui::View>) -> Result<(), Box<dyn std::error::Error>> {
    Ok(tui::run(db, view)?)
}

fn dispatch(command: Command, db: &Database) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        Command::Todo { action } => match action {
            None => open_tui(db, Box::new(TodoView::new())),
            Some(action) => Ok(cli::todo::handle(action, db)?),
        },
        Command::Goal { action } => match action {
            None => open_tui(db, Box::new(GoalView::new())),
            Some(action) => Ok(cli::goal::handle(action, db)?),
        },
        Command::Kudo { action } => match action {
            None => open_tui(db, Box::new(KudoView::new())),
            Some(action) => Ok(cli::kudo::handle(action, db)?),
        },
        Command::Til { action } => match action {
            None => open_tui(db, Box::new(TilView::new())),
            Some(action) => Ok(cli::til::handle(action, db)?),
        },
        Command::Tag { action } => Ok(cli::tag::handle(action, db)?),
        Command::Config { action } => Ok(cli::config::handle(action, db)?),
        Command::Standup { since } => {
            let since_date = since.as_deref().map(cli::parse_date).transpose()?;
            let report = reports::standup::generate(db, since_date)?;
            print!("{report}");
            Ok(())
        }
        Command::Retro { since, last } => {
            let since_date = since.as_deref().map(cli::parse_date).transpose()?;
            let report = reports::retro::generate(db, since_date, last.as_deref())?;
            print!("{report}");
            Ok(())
        }
        Command::Review { half, since } => {
            let since_date = since.as_deref().map(cli::parse_date).transpose()?;
            let report = reports::review::generate(db, half.as_deref(), since_date)?;
            print!("{report}");
            Ok(())
        }
    }
}
