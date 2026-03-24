import { Box, Text } from 'ink';

interface StatusBarProps {
  readonly processedFilter: number | undefined;
  readonly sentimentFilter: string | undefined;
}

function processedLabel(filter: number | undefined): string {
  if (filter === undefined) return 'all';
  return filter === 1 ? 'processed' : 'unprocessed';
}

export function StatusBar({ processedFilter, sentimentFilter }: StatusBarProps) {
  return (
    <Box>
      <Text dimColor>
        Filter: {processedLabel(processedFilter)} | Sentiment: {sentimentFilter ?? 'all'} |{' '}
        <Text bold>1-3</Text> filter <Text bold>s</Text> sentiment <Text bold>Enter</Text> process{' '}
        <Text bold>q</Text> quit
      </Text>
    </Box>
  );
}
