import { Box, Text } from 'ink';
import type { TagWithCount } from './types.ts';

interface TagListProps {
  readonly tags: readonly TagWithCount[];
  readonly selectedIndex: number;
}

function TagRow({ tag, isSelected }: { readonly tag: TagWithCount; readonly isSelected: boolean }) {
  const prefix = isSelected ? '>' : ' ';

  return (
    <Box>
      <Text bold={isSelected} {...(isSelected ? { color: 'white' } : {})}>
        {prefix} {tag.name}
      </Text>
      <Text dimColor>
        {'  '}({tag.entityCount} entities)
      </Text>
    </Box>
  );
}

export function TagList({ tags, selectedIndex }: TagListProps) {
  if (tags.length === 0) {
    return (
      <Box>
        <Text dimColor>No tags found.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {tags.map((tag, idx) => (
        <TagRow key={tag.id} tag={tag} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
