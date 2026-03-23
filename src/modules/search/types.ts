export const SearchEntityType = {
  Todo: 'todo',
  Goal: 'goal',
  Kudos: 'kudos',
  Til: 'til',
  Study: 'study',
  Slack: 'slack',
} as const;
export type SearchEntityType = (typeof SearchEntityType)[keyof typeof SearchEntityType];

export interface SearchResult {
  readonly entity_type: SearchEntityType;
  readonly entity_id: number;
  readonly title: string | null;
  readonly snippet: string;
  readonly created_at: string;
}
