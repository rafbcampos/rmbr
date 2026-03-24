import { GoalStatus, Quarter } from '../../../core/types.ts';

export const KEY = {
  QUIT: 'q',
  QUARTER_CYCLE: 'r',
  COMPLETE: 'd',
  ABANDON: 'a',
  EDIT: 'e',
  STATUS_ALL: '1',
  STATUS_DRAFT: '2',
  STATUS_ACTIVE: '3',
  STATUS_COMPLETED: '4',
  STATUS_ABANDONED: '5',
} as const;

export const STATUS_KEY_MAP: Record<string, GoalStatus | undefined> = {
  [KEY.STATUS_ALL]: undefined,
  [KEY.STATUS_DRAFT]: GoalStatus.Draft,
  [KEY.STATUS_ACTIVE]: GoalStatus.Active,
  [KEY.STATUS_COMPLETED]: GoalStatus.Completed,
  [KEY.STATUS_ABANDONED]: GoalStatus.Abandoned,
};

export const QUARTER_ORDER = [undefined, Quarter.Q1, Quarter.Q2, Quarter.Q3, Quarter.Q4] as const;
