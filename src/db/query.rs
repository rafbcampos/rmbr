/// Dynamic SQL query builder that eliminates manual `param_idx` tracking
/// and the repetitive condition/param assembly pattern across repositories.
pub struct QueryBuilder {
    base: String,
    joins: Vec<String>,
    conditions: Vec<String>,
    param_values: Vec<Box<dyn rusqlite::types::ToSql>>,
    order_by: Option<String>,
}

impl QueryBuilder {
    pub fn new(base: &str) -> Self {
        Self {
            base: base.to_string(),
            joins: Vec::new(),
            conditions: Vec::new(),
            param_values: Vec::new(),
            order_by: None,
        }
    }

    /// Adds a JOIN clause (e.g., "JOIN todo_tags tt ON tt.todo_id = t.id").
    pub fn join(&mut self, clause: &str) -> &mut Self {
        self.joins.push(clause.to_string());
        self
    }

    /// Adds a WHERE condition with a bound parameter.
    /// Use `{}` as placeholder for the parameter index — it will be replaced
    /// with the correct `?N` positional parameter.
    ///
    /// Example: `qb.filter("t.status = {}", Box::new("pending".to_string()))`
    pub fn filter(&mut self, condition_template: &str, value: Box<dyn rusqlite::types::ToSql>) -> &mut Self {
        let idx = self.param_values.len() + 1;
        self.conditions
            .push(condition_template.replace("{}", &format!("?{idx}")));
        self.param_values.push(value);
        self
    }

    /// Adds a WHERE condition with no bound parameter
    /// (e.g., "t.deleted_at IS NULL").
    pub fn filter_raw(&mut self, condition: &str) -> &mut Self {
        self.conditions.push(condition.to_string());
        self
    }

    pub fn order_by(&mut self, clause: &str) -> &mut Self {
        self.order_by = Some(clause.to_string());
        self
    }

    pub fn build(&self) -> String {
        let mut sql = self.base.clone();

        for join in &self.joins {
            sql.push(' ');
            sql.push_str(join);
        }

        if !self.conditions.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&self.conditions.join(" AND "));
        }

        if let Some(ref order) = self.order_by {
            sql.push_str(" ORDER BY ");
            sql.push_str(order);
        }

        sql
    }

    pub fn params(&self) -> Vec<&dyn rusqlite::types::ToSql> {
        self.param_values.iter().map(|p| p.as_ref()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_builder() {
        let qb = QueryBuilder::new("SELECT * FROM todos t");
        assert_eq!(qb.build(), "SELECT * FROM todos t");
        assert!(qb.params().is_empty());
    }

    #[test]
    fn with_filters() {
        let mut qb = QueryBuilder::new("SELECT * FROM todos t");
        qb.filter_raw("t.deleted_at IS NULL");
        qb.filter("t.status = {}", Box::new("pending".to_string()));
        qb.filter("t.priority = {}", Box::new("high".to_string()));
        qb.order_by("t.created_at DESC");

        let sql = qb.build();
        assert_eq!(
            sql,
            "SELECT * FROM todos t WHERE t.deleted_at IS NULL AND t.status = ?1 AND t.priority = ?2 ORDER BY t.created_at DESC"
        );
        assert_eq!(qb.params().len(), 2);
    }

    #[test]
    fn with_join_and_filter() {
        let mut qb = QueryBuilder::new("SELECT DISTINCT t.* FROM todos t");
        qb.join("JOIN todo_tags tt ON tt.todo_id = t.id");
        qb.join("JOIN tags tg ON tg.id = tt.tag_id");
        qb.filter("tg.name = {}", Box::new("backend".to_string()));
        qb.filter_raw("t.deleted_at IS NULL");

        let sql = qb.build();
        assert!(sql.contains("JOIN todo_tags tt"));
        assert!(sql.contains("JOIN tags tg"));
        assert!(sql.contains("tg.name = ?1"));
        assert!(sql.contains("t.deleted_at IS NULL"));
    }
}
