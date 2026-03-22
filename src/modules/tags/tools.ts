import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { TagService } from './service.ts';
import type { Tag, EntityTag } from './types.ts';
import { isEntityType } from './types.ts';
import { getString, getNumber } from '../../shared/tool-args.ts';

function tagToToolResult(tag: Tag): ToolResult {
  return {
    id: tag.id,
    name: tag.name,
    created_at: tag.created_at,
  };
}

function entityTagToToolResult(et: EntityTag): ToolResult {
  return {
    id: et.id,
    tag_id: et.tag_id,
    entity_type: et.entity_type,
    entity_id: et.entity_id,
    created_at: et.created_at,
  };
}

export const tagsTools: readonly McpToolDefinition[] = [
  {
    name: 'rmbr_tag_entity',
    description:
      'Tag an entity (todo, kudos, goal, til, study, slack) with a label. Creates the tag if it does not exist.',
    schema: {
      tag: z.string().describe('Tag name'),
      entity_type: z
        .enum(['todo', 'kudos', 'goal', 'til', 'study', 'slack'])
        .describe('Entity type'),
      entity_id: z.number().describe('Entity ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const tagName = getString(args, 'tag');
      const entityTypeStr = getString(args, 'entity_type');
      if (!isEntityType(entityTypeStr)) {
        throw new Error(`Invalid entity type: ${entityTypeStr}`);
      }
      const entityTag = TagService.tagEntity(
        db,
        tagName,
        entityTypeStr,
        getNumber(args, 'entity_id'),
      );
      return entityTagToToolResult(entityTag);
    },
  },
  {
    name: 'rmbr_untag_entity',
    description: 'Remove a tag from an entity',
    schema: {
      tag: z.string().describe('Tag name'),
      entity_type: z
        .enum(['todo', 'kudos', 'goal', 'til', 'study', 'slack'])
        .describe('Entity type'),
      entity_id: z.number().describe('Entity ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const tagName = getString(args, 'tag');
      const entityTypeStr = getString(args, 'entity_type');
      if (!isEntityType(entityTypeStr)) {
        throw new Error(`Invalid entity type: ${entityTypeStr}`);
      }
      TagService.untagEntity(db, tagName, entityTypeStr, getNumber(args, 'entity_id'));
      return { success: true };
    },
  },
  {
    name: 'rmbr_tag_list',
    description: 'List all tags',
    schema: {},
    handler: async (db): Promise<ToolResult> => {
      const allTags = TagService.listTags(db);
      return {
        data: allTags.map(tagToToolResult),
      };
    },
  },
  {
    name: 'rmbr_tag_get_entities',
    description: 'Get all entities with a given tag, optionally filtered by entity type',
    schema: {
      tag: z.string().describe('Tag name'),
      entity_type: z
        .enum(['todo', 'kudos', 'goal', 'til', 'study', 'slack'])
        .optional()
        .describe('Filter by entity type'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const tagName = getString(args, 'tag');
      const entityTypeStr = typeof args.entity_type === 'string' ? args.entity_type : undefined;
      const entityType =
        entityTypeStr !== undefined && isEntityType(entityTypeStr) ? entityTypeStr : undefined;
      const entities = TagService.getEntitiesByTag(db, tagName, entityType);
      return {
        data: entities.map(entityTagToToolResult),
      };
    },
  },
  {
    name: 'rmbr_entity_tags',
    description: 'Get all tags for a specific entity',
    schema: {
      entity_type: z
        .enum(['todo', 'kudos', 'goal', 'til', 'study', 'slack'])
        .describe('Entity type'),
      entity_id: z.number().describe('Entity ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const entityTypeStr = getString(args, 'entity_type');
      if (!isEntityType(entityTypeStr)) {
        throw new Error(`Invalid entity type: ${entityTypeStr}`);
      }
      const entityTags = TagService.getTagsForEntity(
        db,
        entityTypeStr,
        getNumber(args, 'entity_id'),
      );
      return {
        data: entityTags.map(tagToToolResult),
      };
    },
  },
];
