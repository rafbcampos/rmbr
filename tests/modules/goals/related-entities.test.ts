import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { goalsMigrations } from '../../../src/modules/goals/schema.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { kudosMigrations } from '../../../src/modules/kudos/schema.ts';
import { studyMigrations } from '../../../src/modules/study/schema.ts';
import { slackMigrations } from '../../../src/modules/slack/schema.ts';
import { GoalService } from '../../../src/modules/goals/service.ts';
import { TodoService } from '../../../src/modules/todo/service.ts';
import { KudosService } from '../../../src/modules/kudos/service.ts';
import { StudyService } from '../../../src/modules/study/service.ts';
import { SlackService } from '../../../src/modules/slack/service.ts';
import { NotFoundError } from '../../../src/core/errors.ts';

const allMigrations = [
  ...goalsMigrations,
  ...todoMigrations,
  ...kudosMigrations,
  ...studyMigrations,
  ...slackMigrations,
];

describe('GoalService.getRelatedEntities', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb(allMigrations);
  });

  it('should return empty arrays for a goal with no related entities', () => {
    const goal = GoalService.create(db, 'Standalone goal');

    const related = GoalService.getRelatedEntities(db, goal.id);

    expect(related.todos).toHaveLength(0);
    expect(related.kudos).toHaveLength(0);
    expect(related.studyTopics).toHaveLength(0);
    expect(related.slackMessages).toHaveLength(0);
  });

  it('should return related todos', () => {
    const goal = GoalService.create(db, 'Goal with todos');
    const todo1 = TodoService.create(db, 'Todo 1');
    const todo2 = TodoService.create(db, 'Todo 2');
    TodoService.enrich(db, todo1.id, { goal_id: goal.id });
    TodoService.enrich(db, todo2.id, { goal_id: goal.id });

    const related = GoalService.getRelatedEntities(db, goal.id);

    expect(related.todos).toHaveLength(2);
    expect(related.todos[0]?.id).toBe(todo2.id);
    expect(related.todos[1]?.id).toBe(todo1.id);
  });

  it('should return related kudos', () => {
    const goal = GoalService.create(db, 'Goal with kudos');
    const kudo = KudosService.create(db, 'Great work on the feature');
    KudosService.enrich(db, kudo.id, { goal_id: goal.id });

    const related = GoalService.getRelatedEntities(db, goal.id);

    expect(related.kudos).toHaveLength(1);
    expect(related.kudos[0]?.id).toBe(kudo.id);
  });

  it('should return related study topics', () => {
    const goal = GoalService.create(db, 'Goal with study');
    const topic = StudyService.create(db, 'Learn TypeScript');
    StudyService.enrich(db, topic.id, { goal_id: goal.id });

    const related = GoalService.getRelatedEntities(db, goal.id);

    expect(related.studyTopics).toHaveLength(1);
    expect(related.studyTopics[0]?.id).toBe(topic.id);
  });

  it('should return related slack messages', () => {
    const goal = GoalService.create(db, 'Goal with slack');
    const msg = SlackService.ingest(db, 'Discussion about the goal', '#general', 'alice');
    SlackService.linkGoal(db, msg.id, goal.id);

    const related = GoalService.getRelatedEntities(db, goal.id);

    expect(related.slackMessages).toHaveLength(1);
    expect(related.slackMessages[0]?.id).toBe(msg.id);
  });

  it('should return mixed related entities across all types', () => {
    const goal = GoalService.create(db, 'Full goal');

    const todo = TodoService.create(db, 'Related todo');
    TodoService.enrich(db, todo.id, { goal_id: goal.id });

    const kudo = KudosService.create(db, 'Related kudos');
    KudosService.enrich(db, kudo.id, { goal_id: goal.id });

    const topic = StudyService.create(db, 'Related study');
    StudyService.enrich(db, topic.id, { goal_id: goal.id });

    const msg = SlackService.ingest(db, 'Related slack', '#dev');
    SlackService.linkGoal(db, msg.id, goal.id);

    const related = GoalService.getRelatedEntities(db, goal.id);

    expect(related.todos).toHaveLength(1);
    expect(related.kudos).toHaveLength(1);
    expect(related.studyTopics).toHaveLength(1);
    expect(related.slackMessages).toHaveLength(1);
  });

  it('should not include entities from other goals', () => {
    const goal1 = GoalService.create(db, 'Goal 1');
    const goal2 = GoalService.create(db, 'Goal 2');

    const todo1 = TodoService.create(db, 'Todo for goal 1');
    TodoService.enrich(db, todo1.id, { goal_id: goal1.id });

    const todo2 = TodoService.create(db, 'Todo for goal 2');
    TodoService.enrich(db, todo2.id, { goal_id: goal2.id });

    const related1 = GoalService.getRelatedEntities(db, goal1.id);
    const related2 = GoalService.getRelatedEntities(db, goal2.id);

    expect(related1.todos).toHaveLength(1);
    expect(related1.todos[0]?.id).toBe(todo1.id);
    expect(related2.todos).toHaveLength(1);
    expect(related2.todos[0]?.id).toBe(todo2.id);
  });

  it('should throw NotFoundError for non-existent goal', () => {
    expect(() => GoalService.getRelatedEntities(db, 999)).toThrow(NotFoundError);
  });

  it('should exclude soft-deleted todos from related entities', () => {
    const goal = GoalService.create(db, 'Goal with deleted todo');
    const todo = TodoService.create(db, 'Related todo to delete');
    TodoService.enrich(db, todo.id, { goal_id: goal.id });

    const beforeDelete = GoalService.getRelatedEntities(db, goal.id);
    expect(beforeDelete.todos).toHaveLength(1);

    TodoService.softDeleteEntity(db, todo.id);

    const afterDelete = GoalService.getRelatedEntities(db, goal.id);
    expect(afterDelete.todos).toHaveLength(0);
  });
});
