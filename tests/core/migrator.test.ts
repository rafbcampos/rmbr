import { describe, it, expect, beforeEach } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { createRawTestDb } from '../helpers/db.ts';
import {
  runMigrations,
  rollbackMigrations,
  getAppliedVersions,
  type Migration,
} from '../../src/core/migrator.ts';

const testMigrations: Migration[] = [
  {
    version: 1,
    description: 'Create test table',
    up: 'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)',
    down: 'DROP TABLE test',
  },
  {
    version: 2,
    description: 'Add email column',
    up: 'ALTER TABLE test ADD COLUMN email TEXT',
    down: 'ALTER TABLE test DROP COLUMN email',
  },
];

describe('migrator', () => {
  let db: Database;

  beforeEach(() => {
    db = createRawTestDb();
  });

  it('should apply all pending migrations', () => {
    runMigrations(db, testMigrations);
    const versions = getAppliedVersions(db);
    expect(versions).toEqual([1, 2]);
  });

  it('should not re-apply already applied migrations', () => {
    runMigrations(db, testMigrations);
    runMigrations(db, testMigrations);
    const versions = getAppliedVersions(db);
    expect(versions).toEqual([1, 2]);
  });

  it('should apply migrations in order', () => {
    const reversed = [...testMigrations].reverse();
    runMigrations(db, reversed);
    const versions = getAppliedVersions(db);
    expect(versions).toEqual([1, 2]);
  });

  it('should create the table defined in migration', () => {
    runMigrations(db, [testMigrations[0]!]);
    interface TableRow {
      name: string;
    }
    const result = db
      .query<TableRow, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
      .get();
    expect(result?.name).toBe('test');
  });

  it('should rollback migrations to target version', () => {
    runMigrations(db, testMigrations);
    rollbackMigrations(db, testMigrations, 1);
    const versions = getAppliedVersions(db);
    expect(versions).toEqual([1]);
  });

  it('should rollback all migrations when target is 0', () => {
    runMigrations(db, testMigrations);
    rollbackMigrations(db, testMigrations, 0);
    const versions = getAppliedVersions(db);
    expect(versions).toEqual([]);
  });

  it('should return empty array when no migrations applied', () => {
    const versions = getAppliedVersions(db);
    expect(versions).toEqual([]);
  });
});
