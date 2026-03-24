import { Box, Text } from 'ink';

interface StatusBarProps {
  readonly statusFilter: string | undefined;
  readonly quarterFilter: string | undefined;
}

export function StatusBar({ statusFilter, quarterFilter }: StatusBarProps) {
  return (
    <Box paddingX={1}>
      <Text dimColor>
        Status: <Text bold>{statusFilter ?? 'all'}</Text> | Quarter:{' '}
        <Text bold>{quarterFilter ?? 'all'}</Text>
      </Text>
    </Box>
  );
}
