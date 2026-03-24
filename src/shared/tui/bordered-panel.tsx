import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface BorderedPanelProps {
  readonly title?: string;
  readonly borderColor?: string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly children: ReactNode;
}

export function BorderedPanel({ title, borderColor, width, height, children }: BorderedPanelProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor ?? 'gray'}
      width={width}
      height={height}
    >
      {title !== undefined && (
        <Text bold color={borderColor ?? 'white'}>
          {title}
        </Text>
      )}
      {children}
    </Box>
  );
}
