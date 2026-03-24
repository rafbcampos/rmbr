import { Box, Text } from 'ink';
import type { Kudos } from '../types.ts';
import { KudosDirection } from '../../../core/types.ts';

interface KudosListProps {
  readonly kudos: readonly Kudos[];
  readonly selectedIndex: number;
}

const DIRECTION_LABELS: Record<KudosDirection, { label: string; color: string }> = {
  [KudosDirection.Given]: { label: 'given', color: 'green' },
  [KudosDirection.Received]: { label: 'received', color: 'blue' },
};

function KudosRow({ entry, isSelected }: { readonly entry: Kudos; readonly isSelected: boolean }) {
  const prefix = isSelected ? '>' : ' ';
  const dirInfo = entry.direction !== null ? DIRECTION_LABELS[entry.direction] : null;
  const personStr = entry.person ? ` ${entry.person}:` : '';
  const goalStr = entry.goal_id !== null ? ` goal:#${entry.goal_id}` : '';

  return (
    <Box>
      <Text bold={isSelected} {...(isSelected ? { color: 'white' } : {})}>
        {prefix} #{entry.id}
      </Text>
      {dirInfo !== null ? (
        <Text color={dirInfo.color}> [{dirInfo.label}]</Text>
      ) : (
        <Text dimColor> [?]</Text>
      )}
      <Text bold={isSelected}>{personStr}</Text>
      <Text bold={isSelected}> {entry.summary ?? entry.raw_input}</Text>
      <Text dimColor>{goalStr}</Text>
    </Box>
  );
}

export function KudosList({ kudos, selectedIndex }: KudosListProps) {
  if (kudos.length === 0) {
    return (
      <Box>
        <Text dimColor>No kudos match the current filters.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {kudos.map((entry, idx) => (
        <KudosRow key={entry.id} entry={entry} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
