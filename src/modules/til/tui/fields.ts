import type { FieldDefinition } from '../../../shared/tui/types.ts';
import { FieldType } from '../../../shared/tui/types.ts';

export const TIL_DETAIL_FIELDS: readonly FieldDefinition[] = [
  { key: 'id', label: 'ID', type: FieldType.ReadOnly },
  { key: 'title', label: 'Title', type: FieldType.Text },
  { key: 'content', label: 'Content', type: FieldType.Text },
  { key: 'domain', label: 'Domain', type: FieldType.Text },
  { key: 'tags', label: 'Tags', type: FieldType.Text },
  { key: 'raw_input', label: 'Raw Input', type: FieldType.ReadOnly },
  { key: 'created_at', label: 'Created', type: FieldType.ReadOnly },
] as const;

export const TIL_EDIT_FIELDS: readonly FieldDefinition[] = TIL_DETAIL_FIELDS.filter(
  f => f.type !== FieldType.ReadOnly,
);
