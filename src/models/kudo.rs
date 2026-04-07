use chrono::{DateTime, NaiveDate, Utc};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Kudo {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub from_name: Option<String>,
    pub from_slack: Option<String>,
    pub to_name: Option<String>,
    pub to_slack: Option<String>,
    pub date: NaiveDate,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}
