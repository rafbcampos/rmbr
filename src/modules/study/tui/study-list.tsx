import { Box, Text } from 'ink';
import type { StudyTopic } from '../types.ts';
import type { StudyStatus } from '../../../core/types.ts';
import { StudyStatus as StudyStatusEnum } from '../../../core/types.ts';
import { parseStringArray } from '../../../shared/json-array.ts';
import { StatusDot } from '../../../shared/tui/status-dot.tsx';

interface StudyListProps {
  readonly topics: readonly StudyTopic[];
  readonly selectedIndex: number;
}

const STATUS_COLORS: Record<StudyStatus, string> = {
  [StudyStatusEnum.Queued]: 'blue',
  [StudyStatusEnum.InProgress]: 'green',
  [StudyStatusEnum.Completed]: 'cyan',
  [StudyStatusEnum.Parked]: 'yellow',
};

const ACTIVE_STATUSES = new Set<StudyStatus>([StudyStatusEnum.Queued, StudyStatusEnum.InProgress]);

function StudyRow({
  topic,
  isSelected,
}: {
  readonly topic: StudyTopic;
  readonly isSelected: boolean;
}) {
  const color = STATUS_COLORS[topic.status];
  const domainStr = topic.domain ? ` [${topic.domain}]` : '';
  const notesCount = parseStringArray(topic.notes).length;
  const resourcesCount = parseStringArray(topic.resources).length;
  const countsStr =
    notesCount > 0 || resourcesCount > 0 ? ` (${notesCount}n ${resourcesCount}r)` : '';

  return (
    <Box>
      <Text bold={isSelected} inverse={isSelected}>
        {isSelected ? ' ▸ ' : '   '}
      </Text>
      <Text dimColor>#{topic.id} </Text>
      <StatusDot color={color} filled={ACTIVE_STATUSES.has(topic.status)} />
      <Text color={color} dimColor>
        {' '}
        {topic.status.padEnd(11)}{' '}
      </Text>
      <Text bold={isSelected}>{topic.title ?? topic.raw_input}</Text>
      <Text dimColor>{domainStr}</Text>
      <Text dimColor>{countsStr}</Text>
    </Box>
  );
}

export function StudyList({ topics, selectedIndex }: StudyListProps) {
  if (topics.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No study topics match the current filters.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {topics.map((topic, idx) => (
        <StudyRow key={topic.id} topic={topic} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
