import { eq, and, count, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { NotFoundError } from '../../core/errors.ts';
import type { Tag, EntityTag, EntityType } from './types.ts';
import { toTag, toEntityTag } from './types.ts';
import { tags, entityTags } from './drizzle-schema.ts';

export const TagService = {
  createTag(db: DrizzleDatabase, name: string): Tag {
    const existing = db.select().from(tags).where(eq(tags.name, name)).get();
    if (existing) {
      return toTag(existing);
    }
    const row = db.insert(tags).values({ name }).returning().get();
    return toTag(row);
  },

  tagEntity(
    db: DrizzleDatabase,
    tagName: string,
    entityType: EntityType,
    entityId: number,
  ): EntityTag {
    const tag = TagService.createTag(db, tagName);

    const existing = db
      .select()
      .from(entityTags)
      .where(
        and(
          eq(entityTags.tag_id, tag.id),
          eq(entityTags.entity_type, entityType),
          eq(entityTags.entity_id, entityId),
        ),
      )
      .get();

    if (existing) {
      return toEntityTag(existing);
    }

    const row = db
      .insert(entityTags)
      .values({
        tag_id: tag.id,
        entity_type: entityType,
        entity_id: entityId,
      })
      .returning()
      .get();
    return toEntityTag(row);
  },

  untagEntity(
    db: DrizzleDatabase,
    tagName: string,
    entityType: EntityType,
    entityId: number,
  ): void {
    const tag = db.select().from(tags).where(eq(tags.name, tagName)).get();
    if (!tag) {
      throw new NotFoundError('tag', tagName);
    }

    const existing = db
      .select()
      .from(entityTags)
      .where(
        and(
          eq(entityTags.tag_id, tag.id),
          eq(entityTags.entity_type, entityType),
          eq(entityTags.entity_id, entityId),
        ),
      )
      .get();

    if (!existing) {
      throw new NotFoundError('entity_tag', `${tagName}:${entityType}:${entityId}`);
    }

    db.delete(entityTags).where(eq(entityTags.id, existing.id)).run();
  },

  getTagsForEntity(db: DrizzleDatabase, entityType: EntityType, entityId: number): readonly Tag[] {
    const rows = db
      .select({
        id: tags.id,
        name: tags.name,
        created_at: tags.created_at,
      })
      .from(entityTags)
      .innerJoin(tags, eq(entityTags.tag_id, tags.id))
      .where(and(eq(entityTags.entity_type, entityType), eq(entityTags.entity_id, entityId)))
      .orderBy(tags.name)
      .all();
    return rows.map(toTag);
  },

  getEntitiesByTag(
    db: DrizzleDatabase,
    tagName: string,
    entityType?: EntityType,
  ): readonly EntityTag[] {
    const tag = db.select().from(tags).where(eq(tags.name, tagName)).get();
    if (!tag) {
      return [];
    }

    const conditions: SQL[] = [eq(entityTags.tag_id, tag.id)];
    if (entityType !== undefined) {
      conditions.push(eq(entityTags.entity_type, entityType));
    }

    const rows = db
      .select()
      .from(entityTags)
      .where(and(...conditions))
      .orderBy(entityTags.entity_type, entityTags.entity_id)
      .all();
    return rows.map(toEntityTag);
  },

  listTags(db: DrizzleDatabase): readonly Tag[] {
    const rows = db.select().from(tags).orderBy(tags.name).all();
    return rows.map(toTag);
  },

  listTagsWithCounts(db: DrizzleDatabase): readonly {
    readonly name: string;
    readonly id: number;
    readonly created_at: string;
    readonly entityCount: number;
  }[] {
    const rows = db
      .select({
        id: tags.id,
        name: tags.name,
        created_at: tags.created_at,
        entityCount: count(entityTags.id),
      })
      .from(tags)
      .leftJoin(entityTags, eq(entityTags.tag_id, tags.id))
      .groupBy(tags.id)
      .orderBy(tags.name)
      .all();
    return rows;
  },
};
