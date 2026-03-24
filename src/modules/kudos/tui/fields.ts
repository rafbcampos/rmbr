import { KudosDirection } from '../../../core/types.ts';
import type { FieldDefinition } from '../../../shared/tui/types.ts';
import { FieldType } from '../../../shared/tui/types.ts';

export const KUDOS_DETAIL_FIELDS: readonly FieldDefinition[] = [
  { key: 'id', label: 'ID', type: FieldType.ReadOnly },
  {
    key: 'direction',
    label: 'Direction',
    type: FieldType.Cycle,
    options: Object.values(KudosDirection),
  },
  { key: 'person', label: 'Person', type: FieldType.Text },
  { key: 'summary', label: 'Summary', type: FieldType.Text },
  { key: 'context', label: 'Context', type: FieldType.Text },
  { key: 'goal_id', label: 'Goal ID', type: FieldType.Number },
  { key: 'raw_input', label: 'Raw Input', type: FieldType.ReadOnly },
  { key: 'created_at', label: 'Created', type: FieldType.ReadOnly },
] as const;

export const KUDOS_EDIT_FIELDS: readonly FieldDefinition[] = KUDOS_DETAIL_FIELDS.filter(
  f => f.type !== FieldType.ReadOnly,
);
