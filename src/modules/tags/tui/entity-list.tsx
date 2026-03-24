import { Box, Text } from 'ink';
import type { EntityTag } from '../types.ts';
import { ENTITY_TYPE_COLORS } from './keys.ts';

interface EntityListProps {
  readonly tagName: string;
  readonly entities: readonly EntityTag[];
  readonly selectedIndex: number;
}

function EntityRow({
  entity,
  isSelected,
}: {
  readonly entity: EntityTag;
  readonly isSelected: boolean;
}) {
  const prefix = isSelected ? '>' : ' ';
  const color = ENTITY_TYPE_COLORS[entity.entity_type];

  return (
    <Box>
      <Text bold={isSelected} {...(isSelected ? { color: 'white' } : {})}>
        {prefix}
      </Text>
      <Text color={color}> [{entity.entity_type}]</Text>
      <Text bold={isSelected}> #{entity.entity_id}</Text>
    </Box>
  );
}

export function EntityList({ tagName, entities, selectedIndex }: EntityListProps) {
  if (entities.length === 0) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>Tag: {tagName}</Text>
        </Box>
        <Box>
          <Text dimColor>No entities found.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>Tag: {tagName}</Text>
      </Box>
      {entities.map((entity, idx) => (
        <EntityRow key={entity.id} entity={entity} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
