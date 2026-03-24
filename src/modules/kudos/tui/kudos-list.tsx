import { Box, Text } from 'ink';
import type { Kudos } from '../types.ts';
import { KudosDirection } from '../../../core/types.ts';
import { StatusDot } from '../../../shared/tui/status-dot.tsx';

interface KudosListProps {
  readonly kudos: readonly Kudos[];
  readonly selectedIndex: number;
}

const DIRECTION_COLORS: Record<KudosDirection, string> = {
  [KudosDirection.Given]: 'green',
  [KudosDirection.Received]: 'blue',
};

function KudosRow({ entry, isSelected }: { readonly entry: Kudos; readonly isSelected: boolean }) {
  const dirColor = entry.direction !== null ? DIRECTION_COLORS[entry.direction] : 'gray';
  const dirLabel = entry.direction ?? '?';
  const personStr = entry.person ? ` ${entry.person}:` : '';
  const goalStr = entry.goal_id !== null ? ` goal:#${entry.goal_id}` : '';

  return (
    <Box>
      <Text bold={isSelected} inverse={isSelected}>
        {isSelected ? ' ▸ ' : '   '}
      </Text>
      <Text dimColor>#{entry.id} </Text>
      <StatusDot color={dirColor} filled={entry.direction !== null} />
      <Text color={dirColor} dimColor>
        {' '}
        {dirLabel.padEnd(8)}{' '}
      </Text>
      <Text bold={isSelected}>{personStr}</Text>
      <Text bold={isSelected}> {entry.summary ?? entry.raw_input}</Text>
      <Text dimColor>{goalStr}</Text>
    </Box>
  );
}

export function KudosList({ kudos, selectedIndex }: KudosListProps) {
  if (kudos.length === 0) {
    return (
      <Box paddingX={1}>
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
