import type { DrizzleDatabase } from '../../src/core/drizzle.ts';
import { TodoStatus, GoalStatus, StudyStatus } from '../../src/core/types.ts';
import { todos } from '../../src/modules/todo/drizzle-schema.ts';
import { kudos } from '../../src/modules/kudos/drizzle-schema.ts';
import { goals } from '../../src/modules/goals/drizzle-schema.ts';
import { til } from '../../src/modules/til/drizzle-schema.ts';
import { studyTopics } from '../../src/modules/study/drizzle-schema.ts';
import { slackMessages } from '../../src/modules/slack/drizzle-schema.ts';

export interface TodoFixture {
  raw_input: string;
  title?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  goal_id?: number | null;
}

export interface KudosFixture {
  raw_input: string;
  direction?: string;
  person?: string;
  summary?: string;
  context?: string;
  goal_id?: number | null;
}

export interface GoalFixture {
  raw_input: string;
  title?: string;
  status?: string;
  quarter?: string;
  year?: number;
  kpis?: string;
}

export interface TilFixture {
  raw_input: string;
  title?: string;
  content?: string;
  domain?: string;
  tags?: string;
}

export interface StudyTopicFixture {
  raw_input: string;
  title?: string;
  status?: string;
  domain?: string;
  notes?: string;
  resources?: string;
  goal_id?: number | null;
}

export interface SlackMessageFixture {
  raw_content: string;
  channel?: string;
  sender?: string;
  message_ts?: string;
  sentiment?: string;
  processed?: number;
  todo_id?: number | null;
  goal_id?: number | null;
}

export function insertTodo(db: DrizzleDatabase, fixture: TodoFixture): number {
  const result = db
    .insert(todos)
    .values({
      raw_input: fixture.raw_input,
      title: fixture.title ?? null,
      status: fixture.status ?? TodoStatus.Sketch,
      priority: fixture.priority ?? null,
      due_date: fixture.due_date ?? null,
      goal_id: fixture.goal_id ?? null,
    })
    .returning({ id: todos.id })
    .get();
  return result.id;
}

export function insertKudos(db: DrizzleDatabase, fixture: KudosFixture): number {
  const result = db
    .insert(kudos)
    .values({
      raw_input: fixture.raw_input,
      direction: fixture.direction ?? null,
      person: fixture.person ?? null,
      summary: fixture.summary ?? null,
      context: fixture.context ?? null,
      goal_id: fixture.goal_id ?? null,
    })
    .returning({ id: kudos.id })
    .get();
  return result.id;
}

export function insertGoal(db: DrizzleDatabase, fixture: GoalFixture): number {
  const result = db
    .insert(goals)
    .values({
      raw_input: fixture.raw_input,
      title: fixture.title ?? null,
      status: fixture.status ?? GoalStatus.Draft,
      quarter: fixture.quarter ?? null,
      year: fixture.year ?? null,
      kpis: fixture.kpis ?? '[]',
    })
    .returning({ id: goals.id })
    .get();
  return result.id;
}

export function insertTil(db: DrizzleDatabase, fixture: TilFixture): number {
  const result = db
    .insert(til)
    .values({
      raw_input: fixture.raw_input,
      title: fixture.title ?? null,
      content: fixture.content ?? null,
      domain: fixture.domain ?? null,
      tags: fixture.tags ?? '[]',
    })
    .returning({ id: til.id })
    .get();
  return result.id;
}

export function insertStudyTopic(db: DrizzleDatabase, fixture: StudyTopicFixture): number {
  const result = db
    .insert(studyTopics)
    .values({
      raw_input: fixture.raw_input,
      title: fixture.title ?? null,
      status: fixture.status ?? StudyStatus.Queued,
      domain: fixture.domain ?? null,
      notes: fixture.notes ?? '[]',
      resources: fixture.resources ?? '[]',
      goal_id: fixture.goal_id ?? null,
    })
    .returning({ id: studyTopics.id })
    .get();
  return result.id;
}

export function insertSlackMessage(db: DrizzleDatabase, fixture: SlackMessageFixture): number {
  const result = db
    .insert(slackMessages)
    .values({
      raw_input: fixture.raw_content,
      raw_content: fixture.raw_content,
      channel: fixture.channel ?? null,
      sender: fixture.sender ?? null,
      message_ts: fixture.message_ts ?? null,
      sentiment: fixture.sentiment ?? null,
      processed: fixture.processed ?? 0,
      todo_id: fixture.todo_id ?? null,
      goal_id: fixture.goal_id ?? null,
    })
    .returning({ id: slackMessages.id })
    .get();
  return result.id;
}
