declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

export type TagId = Brand<number, 'TagId'>;
export type EntityTagId = Brand<number, 'EntityTagId'>;

export const EntityType = {
  Todo: 'todo',
  Kudos: 'kudos',
  Goal: 'goal',
  Til: 'til',
  Study: 'study',
  Slack: 'slack',
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

const ENTITY_TYPES = new Set<string>(Object.values(EntityType));

export function isEntityType(value: string): value is EntityType {
  return ENTITY_TYPES.has(value);
}

export interface Tag {
  readonly id: number;
  readonly name: string;
  readonly created_at: string;
}

export interface EntityTag {
  readonly id: number;
  readonly tag_id: number;
  readonly entity_type: EntityType;
  readonly entity_id: number;
  readonly created_at: string;
}

export function toTag(row: { id: number; name: string; created_at: string }): Tag {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
  };
}

export function toEntityTag(row: {
  id: number;
  tag_id: number;
  entity_type: string;
  entity_id: number;
  created_at: string;
}): EntityTag {
  return {
    id: row.id,
    tag_id: row.tag_id,
    entity_type: isEntityType(row.entity_type) ? row.entity_type : EntityType.Todo,
    entity_id: row.entity_id,
    created_at: row.created_at,
  };
}
