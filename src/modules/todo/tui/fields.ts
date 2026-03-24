import { TodoPriority } from '../../../core/types.ts';
import type { FieldDefinition } from '../../../shared/tui/types.ts';
import { FieldType } from '../../../shared/tui/types.ts';

export const TODO_DETAIL_FIELDS: readonly FieldDefinition[] = [
  { key: 'id', label: 'ID', type: FieldType.ReadOnly },
  { key: 'title', label: 'Title', type: FieldType.Text },
  { key: 'status', label: 'Status', type: FieldType.ReadOnly },
  {
    key: 'priority',
    label: 'Priority',
    type: FieldType.Cycle,
    options: Object.values(TodoPriority),
  },
  { key: 'due_date', label: 'Due Date', type: FieldType.Text },
  { key: 'goal_id', label: 'Goal ID', type: FieldType.Number },
  { key: 'raw_input', label: 'Raw Input', type: FieldType.ReadOnly },
  { key: 'created_at', label: 'Created', type: FieldType.ReadOnly },
] as const;

export const TODO_EDIT_FIELDS: readonly FieldDefinition[] = TODO_DETAIL_FIELDS.filter(
  f => f.type !== FieldType.ReadOnly,
);
