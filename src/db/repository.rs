use super::{Database, DatabaseError};

/// Shared CRUD contract for all soft-deletable entities.
///
/// Each implementor defines its own `Entity`, `CreateInput`, `UpdateInput`,
/// and `Filter` types, keeping the interface type-safe while the method
/// signatures remain uniform.
///
/// Repositories are stateless — every method takes `&Database` so the
/// `Database` struct stays focused on connection management.
pub trait CrudRepository {
    type Entity;
    type CreateInput;
    type UpdateInput;
    type Filter;

    fn create(db: &Database, input: Self::CreateInput) -> Result<Self::Entity, DatabaseError>;

    fn get_by_id(db: &Database, id: i64) -> Result<Option<Self::Entity>, DatabaseError>;

    fn list(db: &Database, filter: Self::Filter) -> Result<Vec<Self::Entity>, DatabaseError>;

    fn update(
        db: &Database,
        id: i64,
        input: Self::UpdateInput,
    ) -> Result<Self::Entity, DatabaseError>;

    fn soft_delete(db: &Database, id: i64) -> Result<(), DatabaseError>;

    fn restore(db: &Database, id: i64) -> Result<(), DatabaseError>;

    fn purge(db: &Database, id: i64) -> Result<(), DatabaseError>;
}
