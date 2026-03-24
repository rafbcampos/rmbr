import { Box, Text } from 'ink';

interface StatusBarProps {
  readonly directionFilter: string | undefined;
}

export function StatusBar({ directionFilter }: StatusBarProps) {
  return (
    <Box paddingX={1}>
      <Text dimColor>
        Direction: <Text bold>{directionFilter ?? 'all'}</Text>
      </Text>
    </Box>
  );
}
