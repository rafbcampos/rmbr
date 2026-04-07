use chrono::{DateTime, Utc};
use clap::ValueEnum;
use std::fmt;
use std::str::FromStr;

use super::todo::ParseEnumError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Til {
    pub id: i64,
    pub title: String,
    pub body: String,
    pub source: Option<String>,
    pub category: TilCategory,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum TilCategory {
    Technical,
    Process,
    Domain,
    People,
}

impl fmt::Display for TilCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Technical => write!(f, "technical"),
            Self::Process => write!(f, "process"),
            Self::Domain => write!(f, "domain"),
            Self::People => write!(f, "people"),
        }
    }
}

impl FromStr for TilCategory {
    type Err = ParseEnumError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "technical" | "tech" => Ok(Self::Technical),
            "process" | "proc" => Ok(Self::Process),
            "domain" => Ok(Self::Domain),
            "people" => Ok(Self::People),
            _ => Err(ParseEnumError {
                type_name: "TilCategory",
                input: s.to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn til_category_display_roundtrip() {
        let categories = [
            TilCategory::Technical,
            TilCategory::Process,
            TilCategory::Domain,
            TilCategory::People,
        ];
        for cat in categories {
            let s = cat.to_string();
            let parsed: TilCategory = s.parse().unwrap();
            assert_eq!(cat, parsed);
        }
    }

    #[test]
    fn til_category_accepts_aliases() {
        assert_eq!(
            "tech".parse::<TilCategory>().unwrap(),
            TilCategory::Technical
        );
        assert_eq!(
            "proc".parse::<TilCategory>().unwrap(),
            TilCategory::Process
        );
    }

    #[test]
    fn til_category_rejects_invalid() {
        assert!("nope".parse::<TilCategory>().is_err());
    }
}
