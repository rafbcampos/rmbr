import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { TagService } from './service.ts';
import { isEntityType } from './types.ts';
import { parseId } from '../../shared/validation.ts';

export function registerCommands(program: Command, db: DrizzleDatabase): void {
  const tag = program.command('tag').description('Manage tags');

  tag
    .command('add')
    .description('Tag an entity')
    .argument('<tag>', 'Tag name')
    .argument('<entity_type>', 'Entity type (todo, kudos, goal, til, study, slack)')
    .argument('<entity_id>', 'Entity ID')
    .action((tagName: string, entityType: string, entityId: string) => {
      if (!isEntityType(entityType)) {
        console.error(`Invalid entity type: ${entityType}`);
        return;
      }
      const result = TagService.tagEntity(db, tagName, entityType, parseId(entityId, 'entity'));
      console.log(`Tagged ${entityType} #${result.entity_id} with "${tagName}"`);
    });

  tag
    .command('remove')
    .description('Remove a tag from an entity')
    .argument('<tag>', 'Tag name')
    .argument('<entity_type>', 'Entity type (todo, kudos, goal, til, study, slack)')
    .argument('<entity_id>', 'Entity ID')
    .action((tagName: string, entityType: string, entityId: string) => {
      if (!isEntityType(entityType)) {
        console.error(`Invalid entity type: ${entityType}`);
        return;
      }
      TagService.untagEntity(db, tagName, entityType, parseId(entityId, 'entity'));
      console.log(`Removed tag "${tagName}" from ${entityType} #${entityId}`);
    });

  tag
    .command('list')
    .description('List all tags')
    .action(() => {
      const allTags = TagService.listTags(db);
      if (allTags.length === 0) {
        console.log('No tags found');
        return;
      }
      for (const t of allTags) {
        console.log(`  ${t.name} (id: ${t.id})`);
      }
    });

  tag
    .command('entities')
    .description('Get all entities with a given tag')
    .argument('<tag>', 'Tag name')
    .option('--type <type>', 'Filter by entity type')
    .action((tagName: string, opts: { type?: string }) => {
      const entityType = opts.type !== undefined && isEntityType(opts.type) ? opts.type : undefined;
      const entities = TagService.getEntitiesByTag(db, tagName, entityType);
      if (entities.length === 0) {
        console.log(`No entities tagged with "${tagName}"`);
        return;
      }
      for (const et of entities) {
        console.log(`  ${et.entity_type} #${et.entity_id}`);
      }
    });

  tag
    .command('show')
    .description('Show tags for an entity')
    .argument('<entity_type>', 'Entity type')
    .argument('<entity_id>', 'Entity ID')
    .action((entityType: string, entityId: string) => {
      if (!isEntityType(entityType)) {
        console.error(`Invalid entity type: ${entityType}`);
        return;
      }
      const entityTags = TagService.getTagsForEntity(db, entityType, parseId(entityId, 'entity'));
      if (entityTags.length === 0) {
        console.log(`No tags for ${entityType} #${entityId}`);
        return;
      }
      for (const t of entityTags) {
        console.log(`  ${t.name}`);
      }
    });
}
