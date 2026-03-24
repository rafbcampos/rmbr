import { Box, Text } from 'ink';
import type { ToolSerializable } from '../../core/types.ts';
import { parseStringArray } from '../json-array.ts';
import type { FieldDefinition } from './types.ts';

interface DetailPaneProps {
  readonly fields: readonly FieldDefinition[];
  readonly data: ToolSerializable;
}

export function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const str = String(value);
  if (str === '' || str === '[]') return '—';
  if (str.startsWith('[')) {
    try {
      const items = parseStringArray(str);
      return items.length > 0 ? items.join(', ') : '—';
    } catch {
      return str;
    }
  }
  return str;
}

export function DetailPane({ fields, data }: DetailPaneProps) {
  return (
    <Box flexDirection="column">
      {fields.map(field => (
        <Box key={field.key}>
          <Text bold dimColor>
            {field.label}:{' '}
          </Text>
          <Text>{formatValue(data[field.key])}</Text>
        </Box>
      ))}
    </Box>
  );
}
