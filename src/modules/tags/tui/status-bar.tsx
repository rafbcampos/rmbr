import { Box, Text } from 'ink';
import { TagView } from './types.ts';

interface StatusBarProps {
  readonly view: TagView;
  readonly tagName: string | null;
  readonly entityTypeFilter: string | undefined;
}

export function StatusBar({ view, tagName, entityTypeFilter }: StatusBarProps) {
  if (view === TagView.List) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Select a tag to view its entities</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      <Text dimColor>
        Tag: <Text bold>{tagName}</Text> | Type: <Text bold>{entityTypeFilter ?? 'all'}</Text>
      </Text>
    </Box>
  );
}
