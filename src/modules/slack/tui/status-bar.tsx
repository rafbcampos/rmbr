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
    <Box paddingX={1}>
      <Text dimColor>
        Filter: <Text bold>{processedLabel(processedFilter)}</Text> | Sentiment:{' '}
        <Text bold>{sentimentFilter ?? 'all'}</Text>
      </Text>
    </Box>
  );
}
