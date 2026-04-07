use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    pub key: String,
    pub value: String,
    pub updated_at: DateTime<Utc>,
}
