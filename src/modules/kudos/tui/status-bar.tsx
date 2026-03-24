import { Box, Text } from 'ink';

interface StatusBarProps {
  readonly directionFilter: string | undefined;
}

export function StatusBar({ directionFilter }: StatusBarProps) {
  return (
    <Box>
      <Text dimColor>
        Filter: {directionFilter ?? 'all'} | <Text bold>1-3</Text> filter <Text bold>q</Text> quit
      </Text>
    </Box>
  );
}
