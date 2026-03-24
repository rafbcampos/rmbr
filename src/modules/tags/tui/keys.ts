import { EntityType } from '../types.ts';

export const KEY = {
  QUIT: 'q',
  TYPE_CYCLE: 't',
} as const;

export const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  [EntityType.Todo]: 'blue',
  [EntityType.Kudos]: 'magenta',
  [EntityType.Goal]: 'green',
  [EntityType.Til]: 'cyan',
  [EntityType.Study]: 'yellow',
  [EntityType.Slack]: 'gray',
};
