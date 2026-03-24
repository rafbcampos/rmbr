import { StudyStatus } from '../../../core/types.ts';

export const KEY = {
  QUIT: 'q',
  DOMAIN_CYCLE: 'd',
  COMPLETE: 'c',
  PARK: 'p',
  EDIT: 'e',
  STATUS_ALL: '1',
  STATUS_QUEUED: '2',
  STATUS_IN_PROGRESS: '3',
  STATUS_COMPLETED: '4',
  STATUS_PARKED: '5',
} as const;

export const STATUS_KEY_MAP: Record<string, StudyStatus | undefined> = {
  [KEY.STATUS_ALL]: undefined,
  [KEY.STATUS_QUEUED]: StudyStatus.Queued,
  [KEY.STATUS_IN_PROGRESS]: StudyStatus.InProgress,
  [KEY.STATUS_COMPLETED]: StudyStatus.Completed,
  [KEY.STATUS_PARKED]: StudyStatus.Parked,
};
