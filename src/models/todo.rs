use chrono::{DateTime, NaiveDate, Utc};
use clap::ValueEnum;
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub status: TodoStatus,
    pub priority: Priority,
    pub due_date: Option<NaiveDate>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum TodoStatus {
    Pending,
    InProgress,
    Paused,
    Done,
    Cancelled,
}

impl TodoStatus {
    /// Returns the set of statuses reachable from the current status.
    pub fn valid_transitions(self) -> &'static [TodoStatus] {
        match self {
            Self::Pending => &[Self::InProgress, Self::Cancelled],
            Self::InProgress => &[Self::Paused, Self::Done, Self::Cancelled],
            Self::Paused => &[Self::InProgress, Self::Cancelled],
            Self::Done => &[],
            Self::Cancelled => &[],
        }
    }

    pub fn can_transition_to(self, target: Self) -> bool {
        self.valid_transitions().contains(&target)
    }
}

impl fmt::Display for TodoStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::InProgress => write!(f, "in-progress"),
            Self::Paused => write!(f, "paused"),
            Self::Done => write!(f, "done"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl FromStr for TodoStatus {
    type Err = ParseEnumError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "in-progress" | "inprogress" | "in_progress" => Ok(Self::InProgress),
            "paused" => Ok(Self::Paused),
            "done" => Ok(Self::Done),
            "cancelled" | "canceled" => Ok(Self::Cancelled),
            _ => Err(ParseEnumError {
                type_name: "TodoStatus",
                input: s.to_string(),
            }),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, ValueEnum)]
pub enum Priority {
    Low,
    Medium,
    High,
    Urgent,
}

impl fmt::Display for Priority {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Low => write!(f, "low"),
            Self::Medium => write!(f, "medium"),
            Self::High => write!(f, "high"),
            Self::Urgent => write!(f, "urgent"),
        }
    }
}

impl FromStr for Priority {
    type Err = ParseEnumError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "low" => Ok(Self::Low),
            "medium" | "med" => Ok(Self::Medium),
            "high" => Ok(Self::High),
            "urgent" => Ok(Self::Urgent),
            _ => Err(ParseEnumError {
                type_name: "Priority",
                input: s.to_string(),
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TodoTimeEntry {
    pub id: i64,
    pub todo_id: i64,
    pub action: TimeAction,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimeAction {
    Start,
    Pause,
    Resume,
    Done,
    Cancel,
}

impl TimeAction {
    /// Returns the `TodoStatus` that this action transitions the todo into.
    pub fn target_status(self) -> TodoStatus {
        match self {
            Self::Start | Self::Resume => TodoStatus::InProgress,
            Self::Pause => TodoStatus::Paused,
            Self::Done => TodoStatus::Done,
            Self::Cancel => TodoStatus::Cancelled,
        }
    }
}

impl fmt::Display for TimeAction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Start => write!(f, "start"),
            Self::Pause => write!(f, "pause"),
            Self::Resume => write!(f, "resume"),
            Self::Done => write!(f, "done"),
            Self::Cancel => write!(f, "cancel"),
        }
    }
}

impl FromStr for TimeAction {
    type Err = ParseEnumError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "start" => Ok(Self::Start),
            "pause" => Ok(Self::Pause),
            "resume" => Ok(Self::Resume),
            "done" => Ok(Self::Done),
            "cancel" => Ok(Self::Cancel),
            _ => Err(ParseEnumError {
                type_name: "TimeAction",
                input: s.to_string(),
            }),
        }
    }
}

/// Error returned when parsing a string into an enum variant fails.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseEnumError {
    pub type_name: &'static str,
    pub input: String,
}

impl fmt::Display for ParseEnumError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "invalid {} value: '{}'", self.type_name, self.input)
    }
}

impl std::error::Error for ParseEnumError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn todo_status_display_roundtrip() {
        let statuses = [
            TodoStatus::Pending,
            TodoStatus::InProgress,
            TodoStatus::Paused,
            TodoStatus::Done,
            TodoStatus::Cancelled,
        ];
        for status in statuses {
            let s = status.to_string();
            let parsed: TodoStatus = s.parse().unwrap();
            assert_eq!(status, parsed);
        }
    }

    #[test]
    fn todo_status_accepts_aliases() {
        assert_eq!(
            "inprogress".parse::<TodoStatus>().unwrap(),
            TodoStatus::InProgress
        );
        assert_eq!(
            "in_progress".parse::<TodoStatus>().unwrap(),
            TodoStatus::InProgress
        );
        assert_eq!(
            "canceled".parse::<TodoStatus>().unwrap(),
            TodoStatus::Cancelled
        );
    }

    #[test]
    fn todo_status_rejects_invalid() {
        assert!("nope".parse::<TodoStatus>().is_err());
    }

    #[test]
    fn priority_display_roundtrip() {
        let priorities = [
            Priority::Low,
            Priority::Medium,
            Priority::High,
            Priority::Urgent,
        ];
        for p in priorities {
            let s = p.to_string();
            let parsed: Priority = s.parse().unwrap();
            assert_eq!(p, parsed);
        }
    }

    #[test]
    fn priority_accepts_alias_med() {
        assert_eq!("med".parse::<Priority>().unwrap(), Priority::Medium);
    }

    #[test]
    fn priority_ordering() {
        assert!(Priority::Low < Priority::Medium);
        assert!(Priority::Medium < Priority::High);
        assert!(Priority::High < Priority::Urgent);
    }

    #[test]
    fn time_action_display_roundtrip() {
        let actions = [
            TimeAction::Start,
            TimeAction::Pause,
            TimeAction::Resume,
            TimeAction::Done,
            TimeAction::Cancel,
        ];
        for action in actions {
            let s = action.to_string();
            let parsed: TimeAction = s.parse().unwrap();
            assert_eq!(action, parsed);
        }
    }

    #[test]
    fn todo_status_valid_transitions() {
        assert!(TodoStatus::Pending.can_transition_to(TodoStatus::InProgress));
        assert!(TodoStatus::Pending.can_transition_to(TodoStatus::Cancelled));
        assert!(!TodoStatus::Pending.can_transition_to(TodoStatus::Done));
        assert!(!TodoStatus::Pending.can_transition_to(TodoStatus::Paused));

        assert!(TodoStatus::InProgress.can_transition_to(TodoStatus::Paused));
        assert!(TodoStatus::InProgress.can_transition_to(TodoStatus::Done));
        assert!(TodoStatus::InProgress.can_transition_to(TodoStatus::Cancelled));
        assert!(!TodoStatus::InProgress.can_transition_to(TodoStatus::Pending));

        assert!(TodoStatus::Paused.can_transition_to(TodoStatus::InProgress));
        assert!(TodoStatus::Paused.can_transition_to(TodoStatus::Cancelled));
        assert!(!TodoStatus::Paused.can_transition_to(TodoStatus::Done));

        assert!(TodoStatus::Done.valid_transitions().is_empty());
        assert!(TodoStatus::Cancelled.valid_transitions().is_empty());
    }
}
