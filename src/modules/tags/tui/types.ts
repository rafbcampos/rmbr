export interface TagWithCount {
  readonly name: string;
  readonly id: number;
  readonly created_at: string;
  readonly entityCount: number;
}

export const TagView = {
  List: 'list',
  Entities: 'entities',
} as const;
export type TagView = (typeof TagView)[keyof typeof TagView];
