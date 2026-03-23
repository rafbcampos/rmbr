import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { goalsMigrations } from '../../../src/modules/goals/schema.ts';
import { kudosMigrations } from '../../../src/modules/kudos/schema.ts';
import { tilMigrations } from '../../../src/modules/til/schema.ts';
import { studyMigrations } from '../../../src/modules/study/schema.ts';
import { slackMigrations } from '../../../src/modules/slack/schema.ts';
import {
  insertTodo,
  insertGoal,
  insertKudos,
  insertTil,
  insertStudyTopic,
} from '../../helpers/fixtures.ts';
import * as SearchService from '../../../src/modules/search/service.ts';
import { TodoService } from '../../../src/modules/todo/service.ts';
import { SlackService } from '../../../src/modules/slack/service.ts';
import { SearchEntityType } from '../../../src/modules/search/types.ts';
import { sql } from 'drizzle-orm';

const allMigrations = [
  ...goalsMigrations,
  ...todoMigrations,
  ...kudosMigrations,
  ...tilMigrations,
  ...studyMigrations,
  ...slackMigrations,
];

function insertTilWithFts(
  db: DrizzleDatabase,
  fixture: { raw_input: string; title?: string; content?: string; domain?: string },
): number {
  const id = insertTil(db, fixture);
  db.run(
    sql`INSERT INTO til_fts(rowid, title, content, domain) VALUES (${id}, ${fixture.title ?? null}, ${fixture.content ?? null}, ${fixture.domain ?? null})`,
  );
  return id;
}

describe('SearchService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb(allMigrations);
  });

  describe('search', () => {
    it('returns empty results for no matches', () => {
      const results = SearchService.search(db, 'nonexistent');
      expect(results).toHaveLength(0);
    });

    it('finds matches in todos by title', () => {
      insertTodo(db, { raw_input: 'some task', title: 'Deploy the application' });
      insertTodo(db, { raw_input: 'another task', title: 'Write documentation' });

      const results = SearchService.search(db, 'Deploy');
      expect(results).toHaveLength(1);
      expect(results[0]!.entity_type).toBe(SearchEntityType.Todo);
      expect(results[0]!.snippet).toBe('Deploy the application');
    });

    it('finds matches in todos by raw_input', () => {
      insertTodo(db, { raw_input: 'fix the deployment pipeline' });

      const results = SearchService.search(db, 'deployment');
      expect(results).toHaveLength(1);
      expect(results[0]!.entity_type).toBe(SearchEntityType.Todo);
      expect(results[0]!.entity_id).toBe(1);
    });

    it('finds matches in goals by raw_input', () => {
      insertGoal(db, { raw_input: 'improve team velocity' });

      const results = SearchService.search(db, 'velocity');
      expect(results).toHaveLength(1);
      expect(results[0]!.entity_type).toBe(SearchEntityType.Goal);
      expect(results[0]!.snippet).toBe('improve team velocity');
    });

    it('finds matches in kudos by summary', () => {
      insertKudos(db, {
        raw_input: 'great job on the release',
        summary: 'Excellent release management',
      });

      const results = SearchService.search(db, 'Excellent');
      expect(results).toHaveLength(1);
      expect(results[0]!.entity_type).toBe(SearchEntityType.Kudos);
      expect(results[0]!.snippet).toBe('Excellent release management');
    });

    it('finds matches across multiple entity types', () => {
      insertTodo(db, { raw_input: 'review performance metrics' });
      insertGoal(db, { raw_input: 'track performance goals' });
      insertStudyTopic(db, { raw_input: 'study performance optimization' });

      const results = SearchService.search(db, 'performance');
      expect(results).toHaveLength(3);

      const types = results.map(r => r.entity_type);
      expect(types).toContain(SearchEntityType.Todo);
      expect(types).toContain(SearchEntityType.Goal);
      expect(types).toContain(SearchEntityType.Study);
    });

    it('finds matches in TIL via FTS', () => {
      insertTilWithFts(db, {
        raw_input: 'learned about indexing',
        title: 'Database Indexing Strategies',
        content: 'B-tree indexes improve query performance',
        domain: 'databases',
      });

      const results = SearchService.search(db, 'indexing');
      expect(results).toHaveLength(1);
      expect(results[0]!.entity_type).toBe(SearchEntityType.Til);
      expect(results[0]!.snippet).toBe('Database Indexing Strategies');
    });

    it('finds matches in study topics', () => {
      insertStudyTopic(db, { raw_input: 'learn kubernetes', title: 'Kubernetes Deep Dive' });

      const results = SearchService.search(db, 'Kubernetes');
      expect(results).toHaveLength(1);
      expect(results[0]!.entity_type).toBe(SearchEntityType.Study);
      expect(results[0]!.snippet).toBe('Kubernetes Deep Dive');
    });

    it('respects the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        insertTodo(db, { raw_input: `performance task ${i}` });
      }

      const results = SearchService.search(db, 'performance', 3);
      expect(results).toHaveLength(3);
    });

    it('sorts results by created_at descending', () => {
      insertTodo(db, { raw_input: 'alpha performance' });
      insertGoal(db, { raw_input: 'beta performance' });
      insertStudyTopic(db, { raw_input: 'gamma performance' });

      const results = SearchService.search(db, 'performance');
      expect(results).toHaveLength(3);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.created_at >= results[i + 1]!.created_at).toBe(true);
      }
    });

    it('excludes soft-deleted entities from results', () => {
      const todoId = insertTodo(db, { raw_input: 'searchable widget task', title: 'Widget Task' });

      const beforeDelete = SearchService.search(db, 'widget');
      expect(beforeDelete).toHaveLength(1);
      expect(beforeDelete[0]!.entity_type).toBe(SearchEntityType.Todo);

      TodoService.softDeleteEntity(db, todoId);

      const afterDelete = SearchService.search(db, 'widget');
      expect(afterDelete).toHaveLength(0);
    });

    it('finds matches in slack messages by raw_content', () => {
      SlackService.ingest(db, 'Important deployment discussion', '#releases', 'bob');

      const results = SearchService.search(db, 'deployment discussion');
      expect(results).toHaveLength(1);
      expect(results[0]!.entity_type).toBe(SearchEntityType.Slack);
      expect(results[0]!.snippet).toBe('Important deployment discussion');
    });

    it('falls back to LIKE on malformed FTS query and returns matches', () => {
      insertTilWithFts(db, {
        raw_input: 'learned about caching',
        title: 'Caching Strategies',
        content: 'Redis and Memcached patterns',
        domain: 'backend',
      });

      const wildcard = SearchService.search(db, '*');
      expect(Array.isArray(wildcard)).toBe(true);

      const bareOperator = SearchService.search(db, 'AND');
      expect(Array.isArray(bareOperator)).toBe(true);

      const normalSearch = SearchService.search(db, 'caching');
      expect(normalSearch.some(r => r.entity_type === SearchEntityType.Til)).toBe(true);
    });
  });
});
