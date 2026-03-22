import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { goalsMigrations as goalMigrations } from '../../../src/modules/goals/schema.ts';
import { todoTools } from '../../../src/modules/todo/tools.ts';
import { TodoStatus, EnrichmentStatus } from '../../../src/core/types.ts';
import { insertTodo, insertGoal } from '../../helpers/fixtures.ts';

const findTool = (name: string) => {
  const tool = todoTools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
};

describe('todo tools', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalMigrations, ...todoMigrations]);
  });

  describe('rmbr_todo_create', () => {
    it('creates a raw todo without enrichment fields', async () => {
      const tool = findTool('rmbr_todo_create');
      const result = await tool.handler(db, { raw_input: 'Buy groceries' });

      expect(result.raw_input).toBe('Buy groceries');
      expect(result.status).toBe(TodoStatus.Sketch);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(result.title).toBeNull();
      expect(result.priority).toBeNull();
      expect(result.due_date).toBeNull();
      expect(result.goal_id).toBeNull();
    });

    it('creates a todo with enrichment fields', async () => {
      const goalId = insertGoal(db, { raw_input: 'Ship feature' });
      const tool = findTool('rmbr_todo_create');
      const result = await tool.handler(db, {
        raw_input: 'Finish the report',
        title: 'Complete quarterly report',
        priority: 'high',
        due_date: '2026-04-15',
        goal_id: goalId,
      });

      expect(result.raw_input).toBe('Finish the report');
      expect(result.title).toBe('Complete quarterly report');
      expect(result.priority).toBe('high');
      expect(result.due_date).toBe('2026-04-15');
      expect(result.goal_id).toBe(goalId);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.status).toBe(TodoStatus.Ready);
    });

    it('creates a todo with partial enrichment fields', async () => {
      const tool = findTool('rmbr_todo_create');
      const result = await tool.handler(db, {
        raw_input: 'Fix bug',
        title: 'Fix login page bug',
      });

      expect(result.title).toBe('Fix login page bug');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.priority).toBeNull();
    });
  });

  describe('rmbr_todo_list', () => {
    it('lists all todos', async () => {
      insertTodo(db, { raw_input: 'Todo 1' });
      insertTodo(db, { raw_input: 'Todo 2' });
      insertTodo(db, { raw_input: 'Todo 3' });

      const tool = findTool('rmbr_todo_list');
      const result = await tool.handler(db, {});

      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect((result.data as unknown[]).length).toBe(3);
    });

    it('filters by status', async () => {
      insertTodo(db, { raw_input: 'Sketch one', status: TodoStatus.Sketch });
      insertTodo(db, { raw_input: 'Ready one', status: TodoStatus.Ready });
      insertTodo(db, { raw_input: 'Done one', status: TodoStatus.Done });

      const tool = findTool('rmbr_todo_list');
      const result = await tool.handler(db, { status: TodoStatus.Ready });

      expect(result.total).toBe(1);
      const data = result.data as Array<Record<string, unknown>>;
      expect(data[0]?.raw_input).toBe('Ready one');
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        insertTodo(db, { raw_input: `Todo ${i}` });
      }

      const tool = findTool('rmbr_todo_list');
      const page1 = await tool.handler(db, { page: 1, page_size: 2 });

      expect(page1.total).toBe(5);
      expect((page1.data as unknown[]).length).toBe(2);
      expect(page1.totalPages).toBe(3);

      const page3 = await tool.handler(db, { page: 3, page_size: 2 });
      expect((page3.data as unknown[]).length).toBe(1);
    });

    it('returns empty result when no todos exist', async () => {
      const tool = findTool('rmbr_todo_list');
      const result = await tool.handler(db, {});

      expect(result.total).toBe(0);
      expect((result.data as unknown[]).length).toBe(0);
    });
  });

  describe('rmbr_todo_get', () => {
    it('returns a todo by id', async () => {
      const id = insertTodo(db, { raw_input: 'Test todo' });

      const tool = findTool('rmbr_todo_get');
      const result = await tool.handler(db, { id });

      expect(result.id).toBe(id);
      expect(result.raw_input).toBe('Test todo');
      expect(result.status).toBe(TodoStatus.Sketch);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Raw);
    });

    it('returns all expected fields', async () => {
      const goalId = insertGoal(db, { raw_input: 'Goal' });
      const id = insertTodo(db, {
        raw_input: 'Full todo',
        title: 'A title',
        status: TodoStatus.Ready,
        priority: 'medium',
        due_date: '2026-05-01',
        goal_id: goalId,
      });

      const tool = findTool('rmbr_todo_get');
      const result = await tool.handler(db, { id });

      expect(result.id).toBe(id);
      expect(result.raw_input).toBe('Full todo');
      expect(result.title).toBe('A title');
      expect(result.status).toBe(TodoStatus.Ready);
      expect(result.priority).toBe('medium');
      expect(result.due_date).toBe('2026-05-01');
      expect(result.goal_id).toBe(goalId);
      expect(result.created_at).toBeString();
      expect(result.updated_at).toBeString();
    });
  });

  describe('rmbr_todo_transition', () => {
    it('transitions a todo to a new status', async () => {
      const id = insertTodo(db, { raw_input: 'Test', status: TodoStatus.Ready });

      const tool = findTool('rmbr_todo_transition');
      const result = await tool.handler(db, { id, status: TodoStatus.InProgress });

      expect(result.status).toBe(TodoStatus.InProgress);
    });

    it('uses parseTodoStatus for validation', async () => {
      const id = insertTodo(db, { raw_input: 'Test', status: TodoStatus.Sketch });

      const tool = findTool('rmbr_todo_transition');
      await expect(tool.handler(db, { id, status: 'invalid_status' })).rejects.toThrow();
    });

    it('transitions sketch to cancelled', async () => {
      const id = insertTodo(db, { raw_input: 'Test', status: TodoStatus.Sketch });

      const tool = findTool('rmbr_todo_transition');
      const result = await tool.handler(db, { id, status: TodoStatus.Cancelled });

      expect(result.status).toBe(TodoStatus.Cancelled);
    });
  });

  describe('rmbr_todo_enrich', () => {
    it('enriches a todo with structured fields', async () => {
      const id = insertTodo(db, { raw_input: 'Raw todo' });

      const tool = findTool('rmbr_todo_enrich');
      const result = await tool.handler(db, {
        id,
        title: 'Enriched title',
        priority: 'critical',
        due_date: '2026-06-01',
      });

      expect(result.title).toBe('Enriched title');
      expect(result.priority).toBe('critical');
      expect(result.due_date).toBe('2026-06-01');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('transitions sketch to ready on enrich', async () => {
      const id = insertTodo(db, { raw_input: 'Sketch', status: TodoStatus.Sketch });

      const tool = findTool('rmbr_todo_enrich');
      const result = await tool.handler(db, { id, title: 'Now ready' });

      expect(result.status).toBe(TodoStatus.Ready);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('enriches with goal_id', async () => {
      const goalId = insertGoal(db, { raw_input: 'Goal' });
      const id = insertTodo(db, { raw_input: 'Link to goal' });

      const tool = findTool('rmbr_todo_enrich');
      const result = await tool.handler(db, { id, goal_id: goalId });

      expect(result.goal_id).toBe(goalId);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });
  });
});
