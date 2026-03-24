import { Box, Text } from 'ink';
import type { KeyHint } from './types.ts';

interface KeyHintBarProps {
  readonly hints: readonly KeyHint[];
}

export function KeyHintBar({ hints }: KeyHintBarProps) {
  return (
    <Box borderStyle="round" borderColor="gray" borderTop={false} paddingX={1}>
      {hints.map((hint, idx) => (
        <Box key={hint.key} marginRight={idx < hints.length - 1 ? 2 : 0}>
          <Text bold color="cyan">
            {hint.key}
          </Text>
          <Text dimColor> {hint.action}</Text>
        </Box>
      ))}
    </Box>
  );
}
