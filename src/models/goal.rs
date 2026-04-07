use chrono::{DateTime, NaiveDate, Utc};
use clap::ValueEnum;
use std::fmt;
use std::str::FromStr;

use super::todo::ParseEnumError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Goal {
    pub id: i64,
    pub title: String,
    pub situation: Option<String>,
    pub task: Option<String>,
    pub action: Option<String>,
    pub result: Option<String>,
    pub status: GoalStatus,
    pub due_date: Option<NaiveDate>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Goal {
    /// Returns how many of the four STAR fields are filled in (0..=4).
    pub fn star_completeness(&self) -> u8 {
        let fields: [&Option<String>; 4] = [
            &self.situation,
            &self.task,
            &self.action,
            &self.result,
        ];
        fields
            .iter()
            .filter(|f| f.as_ref().is_some_and(|s| !s.trim().is_empty()))
            .count() as u8
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum GoalStatus {
    NotStarted,
    InProgress,
    Achieved,
    Abandoned,
}

impl fmt::Display for GoalStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotStarted => write!(f, "not-started"),
            Self::InProgress => write!(f, "in-progress"),
            Self::Achieved => write!(f, "achieved"),
            Self::Abandoned => write!(f, "abandoned"),
        }
    }
}

impl FromStr for GoalStatus {
    type Err = ParseEnumError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "not-started" | "notstarted" | "not_started" => Ok(Self::NotStarted),
            "in-progress" | "inprogress" | "in_progress" => Ok(Self::InProgress),
            "achieved" => Ok(Self::Achieved),
            "abandoned" => Ok(Self::Abandoned),
            _ => Err(ParseEnumError {
                type_name: "GoalStatus",
                input: s.to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn goal_status_display_roundtrip() {
        let statuses = [
            GoalStatus::NotStarted,
            GoalStatus::InProgress,
            GoalStatus::Achieved,
            GoalStatus::Abandoned,
        ];
        for status in statuses {
            let s = status.to_string();
            let parsed: GoalStatus = s.parse().unwrap();
            assert_eq!(status, parsed);
        }
    }

    #[test]
    fn goal_status_accepts_aliases() {
        assert_eq!(
            "notstarted".parse::<GoalStatus>().unwrap(),
            GoalStatus::NotStarted
        );
        assert_eq!(
            "not_started".parse::<GoalStatus>().unwrap(),
            GoalStatus::NotStarted
        );
        assert_eq!(
            "in_progress".parse::<GoalStatus>().unwrap(),
            GoalStatus::InProgress
        );
    }

    #[test]
    fn goal_status_rejects_invalid() {
        assert!("nope".parse::<GoalStatus>().is_err());
    }

    #[test]
    fn star_completeness_empty() {
        let goal = Goal {
            id: 1,
            title: "Test".to_string(),
            situation: None,
            task: None,
            action: None,
            result: None,
            status: GoalStatus::NotStarted,
            due_date: None,
            tags: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };
        assert_eq!(goal.star_completeness(), 0);
    }

    #[test]
    fn star_completeness_partial() {
        let goal = Goal {
            id: 1,
            title: "Test".to_string(),
            situation: Some("context".to_string()),
            task: Some("do the thing".to_string()),
            action: None,
            result: None,
            status: GoalStatus::InProgress,
            due_date: None,
            tags: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };
        assert_eq!(goal.star_completeness(), 2);
    }

    #[test]
    fn star_completeness_ignores_whitespace_only() {
        let goal = Goal {
            id: 1,
            title: "Test".to_string(),
            situation: Some("context".to_string()),
            task: Some("  ".to_string()),
            action: None,
            result: None,
            status: GoalStatus::InProgress,
            due_date: None,
            tags: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };
        assert_eq!(goal.star_completeness(), 1);
    }

    #[test]
    fn star_completeness_full() {
        let goal = Goal {
            id: 1,
            title: "Test".to_string(),
            situation: Some("context".to_string()),
            task: Some("do it".to_string()),
            action: Some("did it".to_string()),
            result: Some("shipped".to_string()),
            status: GoalStatus::Achieved,
            due_date: None,
            tags: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };
        assert_eq!(goal.star_completeness(), 4);
    }
}
