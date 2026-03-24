import { Box, Text } from 'ink';
import type { SlackMessage } from '../types.ts';
import type { SlackSentiment } from '../../../core/types.ts';
import { SlackSentiment as SlackSentimentEnum } from '../../../core/types.ts';

interface SlackListProps {
  readonly messages: readonly SlackMessage[];
  readonly selectedIndex: number;
}

const SENTIMENT_COLORS: Record<SlackSentiment, string> = {
  [SlackSentimentEnum.Positive]: 'green',
  [SlackSentimentEnum.Negative]: 'red',
  [SlackSentimentEnum.Neutral]: 'gray',
};

function sentimentColor(sentiment: SlackSentiment | null): string {
  return sentiment !== null ? SENTIMENT_COLORS[sentiment] : 'white';
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

function SlackRow({
  msg,
  isSelected,
}: {
  readonly msg: SlackMessage;
  readonly isSelected: boolean;
}) {
  const prefix = isSelected ? '>' : ' ';
  const processedBadge = msg.processed === 1 ? 'processed' : 'unprocessed';
  const content = truncate(msg.raw_content, 60);
  const sentimentBadge = msg.sentiment !== null ? ` [${msg.sentiment}]` : '';
  const linkedTodo = msg.todo_id !== null ? ` T#${msg.todo_id}` : '';
  const linkedGoal = msg.goal_id !== null ? ` G#${msg.goal_id}` : '';

  return (
    <Box>
      <Text bold={isSelected} {...(isSelected ? { color: 'white' } : {})}>
        {prefix} #{msg.id}
      </Text>
      <Text color={msg.processed === 1 ? 'cyan' : 'yellow'}> [{processedBadge}]</Text>
      {msg.channel !== null && <Text dimColor> #{msg.channel}</Text>}
      {msg.sender !== null && <Text dimColor> @{msg.sender}</Text>}
      <Text bold={isSelected}> {content}</Text>
      {msg.sentiment !== null && (
        <Text color={sentimentColor(msg.sentiment)}>{sentimentBadge}</Text>
      )}
      {msg.todo_id !== null && <Text color="blue">{linkedTodo}</Text>}
      {msg.goal_id !== null && <Text color="magenta">{linkedGoal}</Text>}
    </Box>
  );
}

export function SlackList({ messages, selectedIndex }: SlackListProps) {
  if (messages.length === 0) {
    return (
      <Box>
        <Text dimColor>No Slack messages match the current filters.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {messages.map((msg, idx) => (
        <SlackRow key={msg.id} msg={msg} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
