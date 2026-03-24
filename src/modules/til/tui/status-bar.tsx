import { Box, Text } from 'ink';

interface StatusBarProps {
  readonly domainFilter: string | undefined;
}

export function StatusBar({ domainFilter }: StatusBarProps) {
  return (
    <Box>
      <Text dimColor>
        Domain: {domainFilter ?? 'all'} | <Text bold>d</Text> cycle domain <Text bold>q</Text> quit
      </Text>
    </Box>
  );
}
