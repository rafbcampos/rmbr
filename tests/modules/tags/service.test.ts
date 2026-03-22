import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { tagsMigrations } from '../../../src/modules/tags/schema.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { goalsMigrations } from '../../../src/modules/goals/schema.ts';
import { TagService } from '../../../src/modules/tags/service.ts';
import { EntityType } from '../../../src/modules/tags/types.ts';
import { NotFoundError } from '../../../src/core/errors.ts';
import { insertTodo, insertGoal } from '../../helpers/fixtures.ts';

describe('TagService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalsMigrations, ...todoMigrations, ...tagsMigrations]);
  });

  describe('createTag', () => {
    it('creates a new tag', () => {
      const tag = TagService.createTag(db, 'urgent');
      expect(tag.id).toBe(1);
      expect(tag.name).toBe('urgent');
      expect(tag.created_at).toBeDefined();
    });

    it('returns existing tag if name already exists', () => {
      const first = TagService.createTag(db, 'urgent');
      const second = TagService.createTag(db, 'urgent');
      expect(first.id).toBe(second.id);
    });

    it('creates multiple tags with incrementing ids', () => {
      const t1 = TagService.createTag(db, 'tag1');
      const t2 = TagService.createTag(db, 'tag2');
      expect(t2.id).toBe(t1.id + 1);
    });
  });

  describe('tagEntity', () => {
    it('tags a todo', () => {
      const todoId = insertTodo(db, { raw_input: 'Test todo' });
      const et = TagService.tagEntity(db, 'urgent', EntityType.Todo, todoId);
      expect(et.entity_type).toBe(EntityType.Todo);
      expect(et.entity_id).toBe(todoId);
      expect(et.tag_id).toBeGreaterThan(0);
    });

    it('creates the tag if it does not exist', () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      TagService.tagEntity(db, 'new-tag', EntityType.Todo, todoId);
      const allTags = TagService.listTags(db);
      expect(allTags).toHaveLength(1);
      expect(allTags[0]?.name).toBe('new-tag');
    });

    it('returns existing entity_tag if already tagged', () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      const first = TagService.tagEntity(db, 'urgent', EntityType.Todo, todoId);
      const second = TagService.tagEntity(db, 'urgent', EntityType.Todo, todoId);
      expect(first.id).toBe(second.id);
    });

    it('allows same tag on different entities', () => {
      const todoId = insertTodo(db, { raw_input: 'Todo' });
      const goalId = insertGoal(db, { raw_input: 'Goal' });
      const et1 = TagService.tagEntity(db, 'q1', EntityType.Todo, todoId);
      const et2 = TagService.tagEntity(db, 'q1', EntityType.Goal, goalId);
      expect(et1.id).not.toBe(et2.id);
    });
  });

  describe('untagEntity', () => {
    it('removes a tag from an entity', () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      TagService.tagEntity(db, 'urgent', EntityType.Todo, todoId);
      TagService.untagEntity(db, 'urgent', EntityType.Todo, todoId);
      const tags = TagService.getTagsForEntity(db, EntityType.Todo, todoId);
      expect(tags).toHaveLength(0);
    });

    it('throws NotFoundError for non-existent tag', () => {
      expect(() => TagService.untagEntity(db, 'nonexistent', EntityType.Todo, 1)).toThrow(
        NotFoundError,
      );
    });

    it('throws NotFoundError when entity is not tagged', () => {
      TagService.createTag(db, 'urgent');
      expect(() => TagService.untagEntity(db, 'urgent', EntityType.Todo, 999)).toThrow(
        NotFoundError,
      );
    });
  });

  describe('getTagsForEntity', () => {
    it('returns all tags for an entity', () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      TagService.tagEntity(db, 'urgent', EntityType.Todo, todoId);
      TagService.tagEntity(db, 'q1', EntityType.Todo, todoId);
      TagService.tagEntity(db, 'frontend', EntityType.Todo, todoId);
      const tags = TagService.getTagsForEntity(db, EntityType.Todo, todoId);
      expect(tags).toHaveLength(3);
      expect(tags.map(t => t.name)).toEqual(['frontend', 'q1', 'urgent']);
    });

    it('returns empty array when entity has no tags', () => {
      const tags = TagService.getTagsForEntity(db, EntityType.Todo, 999);
      expect(tags).toHaveLength(0);
    });
  });

  describe('getEntitiesByTag', () => {
    it('returns all entities with a given tag', () => {
      const todoId = insertTodo(db, { raw_input: 'Todo' });
      const goalId = insertGoal(db, { raw_input: 'Goal' });
      TagService.tagEntity(db, 'q1', EntityType.Todo, todoId);
      TagService.tagEntity(db, 'q1', EntityType.Goal, goalId);
      const entities = TagService.getEntitiesByTag(db, 'q1');
      expect(entities).toHaveLength(2);
    });

    it('filters by entity type', () => {
      const todoId = insertTodo(db, { raw_input: 'Todo' });
      const goalId = insertGoal(db, { raw_input: 'Goal' });
      TagService.tagEntity(db, 'q1', EntityType.Todo, todoId);
      TagService.tagEntity(db, 'q1', EntityType.Goal, goalId);
      const entities = TagService.getEntitiesByTag(db, 'q1', EntityType.Todo);
      expect(entities).toHaveLength(1);
      expect(entities[0]?.entity_type).toBe(EntityType.Todo);
    });

    it('returns empty array for non-existent tag', () => {
      const entities = TagService.getEntitiesByTag(db, 'nonexistent');
      expect(entities).toHaveLength(0);
    });
  });

  describe('listTags', () => {
    it('returns all tags sorted alphabetically', () => {
      TagService.createTag(db, 'zulu');
      TagService.createTag(db, 'alpha');
      TagService.createTag(db, 'mike');
      const allTags = TagService.listTags(db);
      expect(allTags).toHaveLength(3);
      expect(allTags.map(t => t.name)).toEqual(['alpha', 'mike', 'zulu']);
    });

    it('returns empty array when no tags exist', () => {
      const allTags = TagService.listTags(db);
      expect(allTags).toHaveLength(0);
    });
  });
});
