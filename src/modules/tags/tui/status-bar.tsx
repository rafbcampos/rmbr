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
      <Box>
        <Text dimColor>
          Select a tag | <Text bold>Enter</Text> select {''}
          <Text bold>q</Text> quit
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text dimColor>
        Tag: {tagName} | Type: {entityTypeFilter ?? 'all'} | <Text bold>t</Text> cycle type {''}
        <Text bold>Esc</Text> back <Text bold>q</Text> quit
      </Text>
    </Box>
  );
}
