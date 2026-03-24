import { useState, useEffect, useCallback } from 'react';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { StudyStatus } from '../../../core/types.ts';
import { StudyStatus as StudyStatusEnum } from '../../../core/types.ts';
import type { StudyTopic } from '../types.ts';
import { StudyService } from '../service.ts';

export interface StudyListState {
  readonly topics: readonly StudyTopic[];
  readonly total: number;
  reload: () => void;
}

export function useStudyTopics(
  db: DrizzleDatabase,
  statusFilter: StudyStatus | undefined,
  domainFilter: string | undefined,
): StudyListState {
  const [topics, setTopics] = useState<readonly StudyTopic[]>([]);
  const [total, setTotal] = useState(0);

  const reload = useCallback(() => {
    const excludeTerminal = statusFilter === undefined;
    const filters = {
      ...(statusFilter !== undefined ? { status: statusFilter } : {}),
      ...(domainFilter !== undefined ? { domain: domainFilter } : {}),
    };
    const result = StudyService.list(db, filters, { page: 1, pageSize: 100 });
    let filtered = result.data;
    if (excludeTerminal) {
      filtered = filtered.filter(t => t.status !== StudyStatusEnum.Completed);
    }
    setTopics(filtered);
    setTotal(filtered.length);
  }, [db, statusFilter, domainFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { topics, total, reload };
}

export function useStudyDomains(db: DrizzleDatabase): readonly string[] {
  const [domains, setDomains] = useState<readonly string[]>([]);

  useEffect(() => {
    setDomains(StudyService.getDomains(db));
  }, [db]);

  return domains;
}

export interface NextQueuedState {
  readonly topic: StudyTopic | null;
  reload: () => void;
}

export function useNextQueued(db: DrizzleDatabase): NextQueuedState {
  const [topic, setTopic] = useState<StudyTopic | null>(null);

  const reload = useCallback(() => {
    setTopic(StudyService.getNext(db));
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { topic, reload };
}
