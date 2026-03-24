import { SlackSentiment } from '../../../core/types.ts';
import type { FieldDefinition } from '../../../shared/tui/types.ts';
import { FieldType } from '../../../shared/tui/types.ts';

export const SLACK_DETAIL_FIELDS: readonly FieldDefinition[] = [
  { key: 'id', label: 'ID', type: FieldType.ReadOnly },
  { key: 'raw_content', label: 'Content', type: FieldType.ReadOnly },
  { key: 'channel', label: 'Channel', type: FieldType.ReadOnly },
  { key: 'sender', label: 'Sender', type: FieldType.ReadOnly },
  {
    key: 'sentiment',
    label: 'Sentiment',
    type: FieldType.Cycle,
    options: Object.values(SlackSentiment),
  },
  { key: 'processed', label: 'Processed', type: FieldType.ReadOnly },
  { key: 'todo_id', label: 'Todo ID', type: FieldType.Number },
  { key: 'goal_id', label: 'Goal ID', type: FieldType.Number },
  { key: 'created_at', label: 'Created', type: FieldType.ReadOnly },
] as const;

export const SLACK_EDIT_FIELDS: readonly FieldDefinition[] = SLACK_DETAIL_FIELDS.filter(
  f => f.type !== FieldType.ReadOnly,
);
