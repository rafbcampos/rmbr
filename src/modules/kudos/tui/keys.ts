import { KudosDirection } from '../../../core/types.ts';

export const KEY = {
  QUIT: 'q',
  EDIT: 'e',
  FILTER_ALL: '1',
  FILTER_GIVEN: '2',
  FILTER_RECEIVED: '3',
} as const;

export const DIRECTION_KEY_MAP: Record<string, KudosDirection | undefined> = {
  [KEY.FILTER_ALL]: undefined,
  [KEY.FILTER_GIVEN]: KudosDirection.Given,
  [KEY.FILTER_RECEIVED]: KudosDirection.Received,
};
