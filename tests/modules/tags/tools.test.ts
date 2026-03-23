import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { insertTodo, insertGoal } from '../../helpers/fixtures.ts';
import { tagsMigrations } from '../../../src/modules/tags/schema.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { goalsMigrations } from '../../../src/modules/goals/schema.ts';
import { tagsTools } from '../../../src/modules/tags/tools.ts';
import { EntityType } from '../../../src/modules/tags/types.ts';
import type { McpToolDefinition } from '../../../src/core/module-contract.ts';
import { getDataArray } from '../../helpers/tool-result.ts';

function findTool(name: string): McpToolDefinition {
  const tool = tagsTools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function createTagsTestDb(): DrizzleDatabase {
  return createTestDb([...goalsMigrations, ...todoMigrations, ...tagsMigrations]);
}

describe('tags tools', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTagsTestDb();
  });

  describe('rmbr_tag_entity', () => {
    const tool = findTool('rmbr_tag_entity');

    it('tags a todo entity', async () => {
      const todoId = insertTodo(db, { raw_input: 'Test todo' });

      const result = await tool.handler(db, {
        tag: 'urgent',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      expect(result.entity_type).toBe(EntityType.Todo);
      expect(result.entity_id).toBe(todoId);
      expect(result.tag_id).toBeGreaterThan(0);
      expect(result.id).toBeGreaterThan(0);
      expect(typeof result.created_at).toBe('string');
    });

    it('tags a goal entity', async () => {
      const goalId = insertGoal(db, { raw_input: 'Test goal' });

      const result = await tool.handler(db, {
        tag: 'q1',
        entity_type: EntityType.Goal,
        entity_id: goalId,
      });
      expect(result.entity_type).toBe(EntityType.Goal);
      expect(result.entity_id).toBe(goalId);
    });

    it('creates the tag if it does not exist', async () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      const listTool = findTool('rmbr_tag_list');

      await tool.handler(db, {
        tag: 'new-tag',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });

      const tags = await listTool.handler(db, {});
      const tagData = getDataArray(tags);
      expect(tagData).toHaveLength(1);
      expect(tagData[0]?.name).toBe('new-tag');
    });

    it('returns existing entity_tag when tagging the same entity twice', async () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });

      const first = await tool.handler(db, {
        tag: 'urgent',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      const second = await tool.handler(db, {
        tag: 'urgent',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      expect(first.id).toBe(second.id);
    });

    it('throws for invalid entity type', async () => {
      await expect(
        tool.handler(db, { tag: 'test', entity_type: 'invalid', entity_id: 1 }),
      ).rejects.toThrow();
    });
  });

  describe('rmbr_untag_entity', () => {
    const tool = findTool('rmbr_untag_entity');
    const tagTool = findTool('rmbr_tag_entity');

    it('removes a tag from an entity', async () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      await tagTool.handler(db, {
        tag: 'urgent',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });

      const result = await tool.handler(db, {
        tag: 'urgent',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      expect(result.success).toBe(true);

      const entityTagsTool = findTool('rmbr_entity_tags');
      const tagsResult = await entityTagsTool.handler(db, {
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      expect(tagsResult.data).toHaveLength(0);
    });

    it('throws for non-existent tag', async () => {
      await expect(
        tool.handler(db, {
          tag: 'nonexistent',
          entity_type: EntityType.Todo,
          entity_id: 1,
        }),
      ).rejects.toThrow();
    });

    it('throws for invalid entity type', async () => {
      await expect(
        tool.handler(db, { tag: 'test', entity_type: 'invalid', entity_id: 1 }),
      ).rejects.toThrow();
    });
  });

  describe('rmbr_tag_list', () => {
    const tool = findTool('rmbr_tag_list');
    const tagTool = findTool('rmbr_tag_entity');

    it('returns empty array when no tags exist', async () => {
      const result = await tool.handler(db, {});
      expect(result.data).toHaveLength(0);
    });

    it('returns all tags', async () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      await tagTool.handler(db, {
        tag: 'urgent',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      await tagTool.handler(db, {
        tag: 'frontend',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });

      const result = await tool.handler(db, {});
      const data = getDataArray(result);
      expect(data).toHaveLength(2);
      const names = data.map(t => t.name);
      expect(names).toContain('urgent');
      expect(names).toContain('frontend');
    });
  });

  describe('rmbr_tag_get_entities', () => {
    const tool = findTool('rmbr_tag_get_entities');
    const tagTool = findTool('rmbr_tag_entity');

    it('returns all entities with a given tag', async () => {
      const todoId = insertTodo(db, { raw_input: 'Todo' });
      const goalId = insertGoal(db, { raw_input: 'Goal' });

      await tagTool.handler(db, {
        tag: 'q1',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      await tagTool.handler(db, {
        tag: 'q1',
        entity_type: EntityType.Goal,
        entity_id: goalId,
      });

      const result = await tool.handler(db, { tag: 'q1' });
      expect(result.data).toHaveLength(2);
    });

    it('filters by entity type', async () => {
      const todoId = insertTodo(db, { raw_input: 'Todo' });
      const goalId = insertGoal(db, { raw_input: 'Goal' });

      await tagTool.handler(db, {
        tag: 'q1',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      await tagTool.handler(db, {
        tag: 'q1',
        entity_type: EntityType.Goal,
        entity_id: goalId,
      });

      const result = await tool.handler(db, {
        tag: 'q1',
        entity_type: EntityType.Todo,
      });
      const data = getDataArray(result);
      expect(data).toHaveLength(1);
      expect(data[0]?.entity_type).toBe(EntityType.Todo);
    });

    it('returns empty array for non-existent tag', async () => {
      const result = await tool.handler(db, { tag: 'nonexistent' });
      expect(result.data).toHaveLength(0);
    });
  });

  describe('rmbr_entity_tags', () => {
    const tool = findTool('rmbr_entity_tags');
    const tagTool = findTool('rmbr_tag_entity');

    it('returns all tags for a specific entity', async () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      await tagTool.handler(db, {
        tag: 'urgent',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      await tagTool.handler(db, {
        tag: 'frontend',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      await tagTool.handler(db, {
        tag: 'q1',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });

      const result = await tool.handler(db, {
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      const data = getDataArray(result);
      expect(data).toHaveLength(3);
      const names = data.map(t => t.name);
      expect(names).toContain('urgent');
      expect(names).toContain('frontend');
      expect(names).toContain('q1');
    });

    it('returns empty array when entity has no tags', async () => {
      const result = await tool.handler(db, {
        entity_type: EntityType.Todo,
        entity_id: 999,
      });
      expect(result.data).toHaveLength(0);
    });

    it('throws for invalid entity type', async () => {
      await expect(tool.handler(db, { entity_type: 'invalid', entity_id: 1 })).rejects.toThrow();
    });

    it('does not return tags from other entities', async () => {
      const todoId = insertTodo(db, { raw_input: 'Todo' });
      const goalId = insertGoal(db, { raw_input: 'Goal' });

      await tagTool.handler(db, {
        tag: 'shared',
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      await tagTool.handler(db, {
        tag: 'goal-only',
        entity_type: EntityType.Goal,
        entity_id: goalId,
      });

      const result = await tool.handler(db, {
        entity_type: EntityType.Todo,
        entity_id: todoId,
      });
      const data = getDataArray(result);
      expect(data).toHaveLength(1);
      expect(data[0]?.name).toBe('shared');
    });
  });
});
