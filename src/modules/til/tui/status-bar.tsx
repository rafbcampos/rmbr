import { Box, Text } from 'ink';

interface StatusBarProps {
  readonly domainFilter: string | undefined;
}

export function StatusBar({ domainFilter }: StatusBarProps) {
  return (
    <Box paddingX={1}>
      <Text dimColor>
        Domain: <Text bold>{domainFilter ?? 'all'}</Text>
      </Text>
    </Box>
  );
}
