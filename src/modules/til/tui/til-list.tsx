import { Box, Text } from 'ink';
import type { Til } from '../types.ts';
import { parseStringArray } from '../../../shared/json-array.ts';
import { StatusDot } from '../../../shared/tui/status-dot.tsx';

interface TilListProps {
  readonly tils: readonly Til[];
  readonly selectedIndex: number;
}

function TilRow({ entry, isSelected }: { readonly entry: Til; readonly isSelected: boolean }) {
  const tagsCount = parseStringArray(entry.tags).length;

  return (
    <Box>
      <Text bold={isSelected} inverse={isSelected}>
        {isSelected ? ' ▸ ' : '   '}
      </Text>
      <Text dimColor>#{entry.id} </Text>
      <StatusDot color={entry.domain !== null ? 'cyan' : 'gray'} filled={entry.domain !== null} />
      {entry.domain !== null ? (
        <Text color="cyan"> {entry.domain.padEnd(12)} </Text>
      ) : (
        <Text dimColor> {'—'.padEnd(12)} </Text>
      )}
      <Text bold={isSelected}>{entry.title ?? entry.raw_input}</Text>
      {tagsCount > 0 ? <Text dimColor> ({tagsCount} tags)</Text> : null}
    </Box>
  );
}

export function TilList({ tils, selectedIndex }: TilListProps) {
  if (tils.length === 0) {
    return (
      <Box paddingX={1}>
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
