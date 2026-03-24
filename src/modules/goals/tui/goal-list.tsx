import { Box, Text } from 'ink';
import type { Goal } from '../types.ts';
import type { GoalStatus } from '../../../core/types.ts';
import { GoalStatus as GoalStatusEnum } from '../../../core/types.ts';
import { parseStringArray } from '../../../shared/json-array.ts';
import { StatusDot } from '../../../shared/tui/status-dot.tsx';

interface GoalListProps {
  readonly goals: readonly Goal[];
  readonly selectedIndex: number;
}

const STATUS_COLORS: Record<GoalStatus, string> = {
  [GoalStatusEnum.Draft]: 'gray',
  [GoalStatusEnum.Active]: 'green',
  [GoalStatusEnum.Completed]: 'cyan',
  [GoalStatusEnum.Abandoned]: 'red',
};

const ACTIVE_STATUSES = new Set<GoalStatus>([GoalStatusEnum.Draft, GoalStatusEnum.Active]);

function GoalRow({ goal, isSelected }: { readonly goal: Goal; readonly isSelected: boolean }) {
  const color = STATUS_COLORS[goal.status];
  const quarterStr =
    goal.quarter !== null && goal.year !== null ? `  ${goal.quarter} ${goal.year}` : '';
  const kpiCount = parseStringArray(goal.kpis).length;
  const kpiStr = kpiCount > 0 ? `  ${kpiCount} KPIs` : '';

  return (
    <Box>
      <Text bold={isSelected} inverse={isSelected}>
        {isSelected ? ' \u25b8 ' : '   '}
      </Text>
      <Text dimColor>#{goal.id} </Text>
      <StatusDot color={color} filled={ACTIVE_STATUSES.has(goal.status)} />
      <Text color={color} dimColor>
        {' '}
        {goal.status.padEnd(10)}{' '}
      </Text>
      <Text bold={isSelected}>{goal.title ?? goal.raw_input}</Text>
      <Text dimColor>{quarterStr}</Text>
      <Text dimColor>{kpiStr}</Text>
    </Box>
  );
}

export function GoalList({ goals, selectedIndex }: GoalListProps) {
  if (goals.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No goals match the current filters.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {goals.map((goal, idx) => (
        <GoalRow key={goal.id} goal={goal} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
