import { useState, useEffect, useCallback } from 'react';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { SlackSentiment } from '../../../core/types.ts';
import type { SlackMessage } from '../types.ts';
import type { SlackFilters } from '../service.ts';
import { SlackService } from '../service.ts';

export interface SlackListState {
  readonly messages: readonly SlackMessage[];
  readonly total: number;
  reload: () => void;
}

export function useSlackMessages(
  db: DrizzleDatabase,
  processedFilter: number | undefined,
  sentimentFilter: SlackSentiment | undefined,
): SlackListState {
  const [messages, setMessages] = useState<readonly SlackMessage[]>([]);
  const [total, setTotal] = useState(0);

  const reload = useCallback(() => {
    const filters: SlackFilters = {
      ...(processedFilter !== undefined ? { processed: processedFilter } : {}),
      ...(sentimentFilter !== undefined ? { sentiment: sentimentFilter } : {}),
    };
    const result = SlackService.list(db, filters, { page: 1, pageSize: 100 });
    setMessages(result.data);
    setTotal(result.total);
  }, [db, processedFilter, sentimentFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { messages, total, reload };
}
