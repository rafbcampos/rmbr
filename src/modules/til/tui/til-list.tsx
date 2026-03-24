import { Box, Text } from 'ink';
import type { Til } from '../types.ts';
import { parseStringArray } from '../../../shared/json-array.ts';

interface TilListProps {
  readonly tils: readonly Til[];
  readonly selectedIndex: number;
}

function TilRow({ entry, isSelected }: { readonly entry: Til; readonly isSelected: boolean }) {
  const prefix = isSelected ? '>' : ' ';
  const tagsCount = parseStringArray(entry.tags).length;

  return (
    <Box>
      <Text bold={isSelected} {...(isSelected ? { color: 'white' } : {})}>
        {prefix} #{entry.id}
      </Text>
      {entry.domain !== null ? (
        <Text color="cyan"> [{entry.domain}]</Text>
      ) : (
        <Text dimColor> [?]</Text>
      )}
      <Text bold={isSelected}> {entry.title ?? entry.raw_input}</Text>
      {tagsCount > 0 ? <Text dimColor> ({tagsCount} tags)</Text> : null}
      <Text dimColor> {entry.created_at}</Text>
    </Box>
  );
}

export function TilList({ tils, selectedIndex }: TilListProps) {
  if (tils.length === 0) {
    return (
      <Box>
        <Text dimColor>No TILs match the current filters.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {tils.map((entry, idx) => (
        <TilRow key={entry.id} entry={entry} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
