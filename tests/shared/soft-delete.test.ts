import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../src/core/drizzle.ts';
import { createTestDb } from '../helpers/db.ts';
import { todoMigrations } from '../../src/modules/todo/schema.ts';
import { goalsMigrations } from '../../src/modules/goals/schema.ts';
import { todos } from '../../src/modules/todo/drizzle-schema.ts';
import { softDelete, restore, notDeletedCondition } from '../../src/shared/soft-delete.ts';
import { NotFoundError } from '../../src/core/errors.ts';
import { eq, and } from 'drizzle-orm';

describe('soft-delete', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalsMigrations, ...todoMigrations]);
  });

  function insertRow(rawInput: string): number {
    const row = db.insert(todos).values({ raw_input: rawInput }).returning({ id: todos.id }).get();
    return row.id;
  }

  describe('softDelete', () => {
    it('sets deleted_at on an existing entity', () => {
      const id = insertRow('test todo');
      softDelete(db, todos, 'todo', id);

      const row = db.select().from(todos).where(eq(todos.id, id)).get();
      expect(row).toBeTruthy();
      expect(row!.deleted_at).not.toBeNull();
    });

    it('throws NotFoundError for non-existent entity', () => {
      expect(() => softDelete(db, todos, 'todo', 999)).toThrow(NotFoundError);
    });

    it('is idempotent — second call preserves original deleted_at', () => {
      const id = insertRow('idempotent todo');
      softDelete(db, todos, 'todo', id);

      const firstRow = db.select().from(todos).where(eq(todos.id, id)).get();
      const firstDeletedAt = firstRow!.deleted_at;
      expect(firstDeletedAt).not.toBeNull();

      softDelete(db, todos, 'todo', id);

      const secondRow = db.select().from(todos).where(eq(todos.id, id)).get();
      expect(secondRow!.deleted_at).toBe(firstDeletedAt);
    });
  });

  describe('restore', () => {
    it('clears deleted_at on a soft-deleted entity', () => {
      const id = insertRow('test todo');
      softDelete(db, todos, 'todo', id);
      restore(db, todos, 'todo', id);

      const row = db.select().from(todos).where(eq(todos.id, id)).get();
      expect(row).toBeTruthy();
      expect(row!.deleted_at).toBeNull();
    });

    it('throws NotFoundError for non-existent entity', () => {
      expect(() => restore(db, todos, 'todo', 999)).toThrow(NotFoundError);
    });
  });

  describe('notDeletedCondition', () => {
    it('filters out soft-deleted rows', () => {
      const id1 = insertRow('active todo');
      const id2 = insertRow('deleted todo');
      softDelete(db, todos, 'todo', id2);

      const rows = db
        .select()
        .from(todos)
        .where(and(notDeletedCondition(todos.deleted_at)))
        .all();

      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(id1);
    });

    it('returns all rows when not applied', () => {
      insertRow('todo 1');
      const id2 = insertRow('todo 2');
      softDelete(db, todos, 'todo', id2);

      const rows = db.select().from(todos).all();
      expect(rows).toHaveLength(2);
    });
  });

  describe('round-trip', () => {
    it('soft-delete then restore returns entity to active state', () => {
      const id = insertRow('round-trip todo');
      softDelete(db, todos, 'todo', id);

      const deletedRows = db
        .select()
        .from(todos)
        .where(notDeletedCondition(todos.deleted_at))
        .all();
      expect(deletedRows).toHaveLength(0);

      restore(db, todos, 'todo', id);

      const restoredRows = db
        .select()
        .from(todos)
        .where(notDeletedCondition(todos.deleted_at))
        .all();
      expect(restoredRows).toHaveLength(1);
      expect(restoredRows[0]!.id).toBe(id);
      expect(restoredRows[0]!.deleted_at).toBeNull();
    });
  });
});
