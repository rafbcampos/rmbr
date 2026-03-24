import { SlackSentiment } from '../../../core/types.ts';

export const KEY = {
  QUIT: 'q',
  SENTIMENT_CYCLE: 's',
  FILTER_ALL: '1',
  UNPROCESSED: '2',
  PROCESSED: '3',
} as const;

export const PROCESSED_KEY_MAP: Record<string, number | undefined> = {
  [KEY.FILTER_ALL]: undefined,
  [KEY.UNPROCESSED]: 0,
  [KEY.PROCESSED]: 1,
};

export const SENTIMENT_ORDER = [
  undefined,
  SlackSentiment.Positive,
  SlackSentiment.Negative,
  SlackSentiment.Neutral,
] as const;
