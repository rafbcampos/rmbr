import { Box, Text } from 'ink';
import type { SlackMessage } from '../types.ts';
import type { SlackSentiment } from '../../../core/types.ts';
import { SlackSentiment as SlackSentimentEnum } from '../../../core/types.ts';
import { StatusDot } from '../../../shared/tui/status-dot.tsx';

interface SlackListProps {
  readonly messages: readonly SlackMessage[];
  readonly selectedIndex: number;
}

const SENTIMENT_COLORS: Record<SlackSentiment, string> = {
  [SlackSentimentEnum.Positive]: 'green',
  [SlackSentimentEnum.Negative]: 'red',
  [SlackSentimentEnum.Neutral]: 'gray',
};

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
  const processedColor = msg.processed === 1 ? 'cyan' : 'yellow';
  const content = truncate(msg.raw_content, 60);
  const sentimentColor = msg.sentiment !== null ? SENTIMENT_COLORS[msg.sentiment] : 'gray';

  return (
    <Box>
      <Text bold={isSelected} inverse={isSelected}>
        {isSelected ? ' ▸ ' : '   '}
      </Text>
      <Text dimColor>#{msg.id} </Text>
      <StatusDot color={processedColor} filled={msg.processed === 1} />
      {msg.channel !== null && <Text dimColor> #{msg.channel}</Text>}
      {msg.sender !== null && <Text dimColor> @{msg.sender}</Text>}
      <Text bold={isSelected}> {content}</Text>
      {msg.sentiment !== null && <Text color={sentimentColor}> [{msg.sentiment}]</Text>}
      {msg.todo_id !== null && <Text color="blue"> T#{msg.todo_id}</Text>}
      {msg.goal_id !== null && <Text color="magenta"> G#{msg.goal_id}</Text>}
    </Box>
  );
}

export function SlackList({ messages, selectedIndex }: SlackListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1}>
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
