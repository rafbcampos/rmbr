import { useState, useEffect, useCallback } from 'react';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { GoalStatus, Quarter } from '../../../core/types.ts';
import { GoalStatus as GoalStatusEnum } from '../../../core/types.ts';
import type { Goal } from '../types.ts';
import { GoalService } from '../service.ts';

export interface GoalListState {
  readonly goals: readonly Goal[];
  readonly total: number;
  reload: () => void;
}

export function useGoals(
  db: DrizzleDatabase,
  statusFilter: GoalStatus | undefined,
  quarterFilter: Quarter | undefined,
): GoalListState {
  const [goals, setGoals] = useState<readonly Goal[]>([]);
  const [total, setTotal] = useState(0);

  const reload = useCallback(() => {
    const excludeTerminal = statusFilter === undefined;
    const filters = {
      ...(statusFilter !== undefined ? { status: statusFilter } : {}),
      ...(quarterFilter !== undefined ? { quarter: quarterFilter } : {}),
    };
    const result = GoalService.list(db, filters, { page: 1, pageSize: 100 });
    let filtered = result.data;
    if (excludeTerminal) {
      filtered = filtered.filter(
        g => g.status !== GoalStatusEnum.Completed && g.status !== GoalStatusEnum.Abandoned,
      );
    }
    setGoals(filtered);
    setTotal(filtered.length);
  }, [db, statusFilter, quarterFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { goals, total, reload };
}
