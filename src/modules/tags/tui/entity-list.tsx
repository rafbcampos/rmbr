import { Box, Text } from 'ink';
import type { EntityTag } from '../types.ts';
import { ENTITY_TYPE_COLORS } from './keys.ts';
import { StatusDot } from '../../../shared/tui/status-dot.tsx';

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
  const color = ENTITY_TYPE_COLORS[entity.entity_type];

  return (
    <Box>
      <Text bold={isSelected} inverse={isSelected}>
        {isSelected ? ' ▸ ' : '   '}
      </Text>
      <StatusDot color={color} filled={true} />
      <Text color={color}> {entity.entity_type.padEnd(6)}</Text>
      <Text bold={isSelected}> #{entity.entity_id}</Text>
    </Box>
  );
}

export function EntityList({ tagName, entities, selectedIndex }: EntityListProps) {
  if (entities.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No entities found for tag: {tagName}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {entities.map((entity, idx) => (
        <EntityRow key={entity.id} entity={entity} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
