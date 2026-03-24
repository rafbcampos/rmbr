import type { FieldDefinition } from '../../../shared/tui/types.ts';
import { FieldType } from '../../../shared/tui/types.ts';

export const STUDY_DETAIL_FIELDS: readonly FieldDefinition[] = [
  { key: 'id', label: 'ID', type: FieldType.ReadOnly },
  { key: 'title', label: 'Title', type: FieldType.Text },
  { key: 'status', label: 'Status', type: FieldType.ReadOnly },
  { key: 'domain', label: 'Domain', type: FieldType.Text },
  { key: 'goal_id', label: 'Goal ID', type: FieldType.Number },
  { key: 'notes', label: 'Notes', type: FieldType.ReadOnly },
  { key: 'resources', label: 'Resources', type: FieldType.ReadOnly },
  { key: 'raw_input', label: 'Raw Input', type: FieldType.ReadOnly },
  { key: 'created_at', label: 'Created', type: FieldType.ReadOnly },
] as const;

export const STUDY_EDIT_FIELDS: readonly FieldDefinition[] = STUDY_DETAIL_FIELDS.filter(
  f => f.type !== FieldType.ReadOnly,
);
