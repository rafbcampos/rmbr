import { useState, useEffect, useCallback } from 'react';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { Til } from '../types.ts';
import { TilService } from '../service.ts';

export interface TilListState {
  readonly tils: readonly Til[];
  readonly total: number;
  reload: () => void;
}

export function useTilList(db: DrizzleDatabase, domainFilter: string | undefined): TilListState {
  const [tils, setTils] = useState<readonly Til[]>([]);
  const [total, setTotal] = useState(0);

  const reload = useCallback(() => {
    const filters = domainFilter !== undefined ? { domain: domainFilter } : {};
    const result = TilService.list(db, filters, { page: 1, pageSize: 100 });
    setTils(result.data);
    setTotal(result.total);
  }, [db, domainFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tils, total, reload };
}

export function useDomains(db: DrizzleDatabase): readonly string[] {
  const [domains, setDomains] = useState<readonly string[]>([]);

  useEffect(() => {
    const result = TilService.getDomains(db);
    setDomains(result);
  }, [db]);

  return domains;
}
