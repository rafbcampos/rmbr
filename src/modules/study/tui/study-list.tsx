import { Box, Text } from 'ink';
import type { StudyTopic } from '../types.ts';
import type { StudyStatus } from '../../../core/types.ts';
import { StudyStatus as StudyStatusEnum } from '../../../core/types.ts';
import { parseStringArray } from '../../../shared/json-array.ts';

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

function StudyRow({
  topic,
  isSelected,
}: {
  readonly topic: StudyTopic;
  readonly isSelected: boolean;
}) {
  const color = STATUS_COLORS[topic.status];
  const prefix = isSelected ? '>' : ' ';
  const domainStr = topic.domain ? ` [${topic.domain}]` : '';
  const notesCount = parseStringArray(topic.notes).length;
  const resourcesCount = parseStringArray(topic.resources).length;
  const countsStr =
    notesCount > 0 || resourcesCount > 0 ? ` (${notesCount}n ${resourcesCount}r)` : '';

  return (
    <Box>
      <Text bold={isSelected} {...(isSelected ? { color: 'white' } : {})}>
        {prefix} #{topic.id}
      </Text>
      <Text color={color}> [{topic.status}]</Text>
      <Text bold={isSelected}> {topic.title ?? topic.raw_input}</Text>
      <Text dimColor>{domainStr}</Text>
      <Text dimColor>{countsStr}</Text>
    </Box>
  );
}

export function StudyList({ topics, selectedIndex }: StudyListProps) {
  if (topics.length === 0) {
    return (
      <Box>
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
