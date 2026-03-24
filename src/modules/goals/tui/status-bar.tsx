import { Box, Text } from 'ink';

interface StatusBarProps {
  readonly statusFilter: string | undefined;
  readonly quarterFilter: string | undefined;
}

export function StatusBar({ statusFilter, quarterFilter }: StatusBarProps) {
  return (
    <Box>
      <Text dimColor>
        Filter: {statusFilter ?? 'all'} | Quarter: {quarterFilter ?? 'all'} | <Text bold>1-5</Text>{' '}
        status <Text bold>r</Text> quarter <Text bold>Enter</Text> activate <Text bold>d</Text>{' '}
        complete <Text bold>a</Text> abandon <Text bold>q</Text> quit
      </Text>
    </Box>
  );
}
