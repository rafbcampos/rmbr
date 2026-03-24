import { Quarter } from '../../../core/types.ts';
import type { FieldDefinition } from '../../../shared/tui/types.ts';
import { FieldType } from '../../../shared/tui/types.ts';

export const GOAL_DETAIL_FIELDS: readonly FieldDefinition[] = [
  { key: 'id', label: 'ID', type: FieldType.ReadOnly },
  { key: 'title', label: 'Title', type: FieldType.Text },
  { key: 'status', label: 'Status', type: FieldType.ReadOnly },
  { key: 'quarter', label: 'Quarter', type: FieldType.Cycle, options: Object.values(Quarter) },
  { key: 'year', label: 'Year', type: FieldType.Number },
  { key: 'kpis', label: 'KPIs', type: FieldType.Text },
  { key: 'raw_input', label: 'Raw Input', type: FieldType.ReadOnly },
  { key: 'created_at', label: 'Created', type: FieldType.ReadOnly },
] as const;

export const GOAL_EDIT_FIELDS: readonly FieldDefinition[] = GOAL_DETAIL_FIELDS.filter(
  f => f.type !== FieldType.ReadOnly,
);
