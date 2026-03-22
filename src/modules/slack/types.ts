import { SlackSentiment } from '../../core/types.ts';
import type { BaseEntity } from '../../core/types.ts';
import { parseEnrichmentStatus } from '../../shared/type-guards.ts';

export interface SlackMessage extends BaseEntity {
  readonly raw_content: string;
  readonly channel: string | null;
  readonly sender: string | null;
  readonly message_ts: string | null;
  readonly sentiment: SlackSentiment | null;
  readonly processed: number;
  readonly todo_id: number | null;
  readonly goal_id: number | null;
}

export interface SlackMessageRow {
  id: number;
  raw_input: string;
  raw_content: string;
  channel: string | null;
  sender: string | null;
  message_ts: string | null;
  sentiment: string | null;
  processed: number;
  todo_id: number | null;
  goal_id: number | null;
  enrichment_status: string;
  created_at: string;
  updated_at: string;
}

const SLACK_SENTIMENTS = new Set<string>(Object.values(SlackSentiment));

export function isSlackSentiment(value: string): value is SlackSentiment {
  return SLACK_SENTIMENTS.has(value);
}

function parseSentiment(value: string | null): SlackSentiment | null {
  if (value === null) return null;
  if (isSlackSentiment(value)) return value;
  return null;
}

export function toSlackMessage(row: SlackMessageRow): SlackMessage {
  return {
    id: row.id,
    raw_input: row.raw_input,
    raw_content: row.raw_content,
    channel: row.channel,
    sender: row.sender,
    message_ts: row.message_ts,
    sentiment: parseSentiment(row.sentiment),
    processed: row.processed,
    todo_id: row.todo_id,
    goal_id: row.goal_id,
    enrichment_status: parseEnrichmentStatus(row.enrichment_status),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
