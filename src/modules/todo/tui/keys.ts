import { TodoStatus } from '../../../core/types.ts';

export const KEY = {
  QUIT: 'q',
  DONE: 'd',
  PRIORITY_CYCLE: 'p',
  STATUS_ALL: '1',
  STATUS_READY: '2',
  STATUS_IN_PROGRESS: '3',
  STATUS_PAUSED: '4',
  STATUS_DONE: '5',
} as const;

export const STATUS_KEY_MAP: Record<string, TodoStatus | undefined> = {
  [KEY.STATUS_ALL]: undefined,
  [KEY.STATUS_READY]: TodoStatus.Ready,
  [KEY.STATUS_IN_PROGRESS]: TodoStatus.InProgress,
  [KEY.STATUS_PAUSED]: TodoStatus.Paused,
  [KEY.STATUS_DONE]: TodoStatus.Done,
};

export const PRIORITY_ORDER = [undefined, 'critical', 'high', 'medium', 'low'] as const;
