import { useState, useEffect, useCallback } from 'react';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { KudosDirection } from '../../../core/types.ts';
import type { Kudos } from '../types.ts';
import { KudosService } from '../service.ts';

export interface KudosListState {
  readonly kudos: readonly Kudos[];
  readonly total: number;
  reload: () => void;
}

export function useKudosList(
  db: DrizzleDatabase,
  directionFilter: KudosDirection | undefined,
): KudosListState {
  const [kudos, setKudos] = useState<readonly Kudos[]>([]);
  const [total, setTotal] = useState(0);

  const reload = useCallback(() => {
    const filters = directionFilter !== undefined ? { direction: directionFilter } : {};
    const result = KudosService.list(db, filters, { page: 1, pageSize: 100 });
    setKudos(result.data);
    setTotal(result.total);
  }, [db, directionFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { kudos, total, reload };
}
