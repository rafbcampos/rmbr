import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ToolSerializable } from '../../core/types.ts';
import type { FieldDefinition } from './types.ts';
import { FieldType } from './types.ts';

export type EditValues = Record<string, string | number | null>;

interface EditFormProps {
  readonly fields: readonly FieldDefinition[];
  readonly initialValues: ToolSerializable;
  readonly onSave: (values: EditValues) => void;
  readonly onCancel: () => void;
}

function toDisplayValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function getEditableFields(fields: readonly FieldDefinition[]): readonly FieldDefinition[] {
  return fields.filter(f => f.type !== FieldType.ReadOnly);
}

export function EditForm({ fields, initialValues, onSave, onCancel }: EditFormProps) {
  const editableFields = getEditableFields(fields);
  const [activeIndex, setActiveIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of editableFields) {
      init[field.key] = toDisplayValue(initialValues[field.key]);
    }
    return init;
  });

  const activeField = editableFields[activeIndex];

  const updateValue = useCallback((key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const cycleCurrent = useCallback(() => {
    if (activeField === undefined || activeField.type !== FieldType.Cycle) return;
    const current = values[activeField.key] ?? '';
    const idx = activeField.options.indexOf(current);
    const next = activeField.options[(idx + 1) % activeField.options.length];
    if (next !== undefined) {
      updateValue(activeField.key, next);
    }
  }, [activeField, values, updateValue]);

  const buildResult = useCallback((): EditValues => {
    const result: EditValues = {};
    for (const field of editableFields) {
      const raw = values[field.key] ?? '';
      if (raw === '') {
        result[field.key] = null;
      } else if (field.type === FieldType.Number) {
        const num = Number(raw);
        result[field.key] = Number.isFinite(num) ? num : null;
      } else {
        result[field.key] = raw;
      }
    }
    return result;
  }, [editableFields, values]);

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }

      if (key.ctrl && input === 's') {
        onSave(buildResult());
        return;
      }

      if (key.tab) {
        if (key.shift) {
          setActiveIndex(i => (i - 1 + editableFields.length) % editableFields.length);
        } else {
          setActiveIndex(i => (i + 1) % editableFields.length);
        }
        return;
      }

      if (activeField?.type === FieldType.Cycle) {
        if (key.return || input === ' ') {
          cycleCurrent();
        }
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        Edit Mode
      </Text>
      <Box marginTop={1} flexDirection="column">
        {editableFields.map((field, idx) => {
          const isFocused = idx === activeIndex;
          const value = values[field.key] ?? '';

          return (
            <Box key={field.key}>
              {isFocused ? (
                <Text bold color="cyan">
                  {'▸'} {field.label}:{' '}
                </Text>
              ) : (
                <Text dimColor> {field.label}: </Text>
              )}
              {field.type === FieldType.Cycle ? (
                isFocused ? (
                  <Text color="white">
                    {value || '—'} {'◂▸'}
                  </Text>
                ) : (
                  <Text>{value || '—'}</Text>
                )
              ) : (
                <Box>
                  {isFocused ? (
                    <TextInput
                      value={value}
                      onChange={v => updateValue(field.key, v)}
                      focus={true}
                      showCursor={true}
                    />
                  ) : (
                    <Text>{value || '—'}</Text>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          <Text bold>Tab</Text> next field <Text bold>Esc</Text> cancel <Text bold>Ctrl+S</Text>{' '}
          save
        </Text>
      </Box>
    </Box>
  );
}
