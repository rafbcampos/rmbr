import { useState, useEffect, useCallback } from 'react';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { EntityTag, EntityType } from '../types.ts';
import { TagService } from '../service.ts';
import type { TagWithCount } from './types.ts';

export interface TagListState {
  readonly tags: readonly TagWithCount[];
  reload: () => void;
}

export function useTagList(db: DrizzleDatabase): TagListState {
  const [tags, setTags] = useState<readonly TagWithCount[]>([]);

  const reload = useCallback(() => {
    setTags(TagService.listTagsWithCounts(db));
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tags, reload };
}

export interface TagEntitiesState {
  readonly entities: readonly EntityTag[];
  reload: () => void;
}

export function useTagEntities(
  db: DrizzleDatabase,
  tagName: string | null,
  entityTypeFilter: EntityType | undefined,
): TagEntitiesState {
  const [entities, setEntities] = useState<readonly EntityTag[]>([]);

  const reload = useCallback(() => {
    if (tagName === null) {
      setEntities([]);
      return;
    }
    const result = TagService.getEntitiesByTag(db, tagName, entityTypeFilter);
    setEntities(result);
  }, [db, tagName, entityTypeFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { entities, reload };
}
