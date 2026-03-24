export const ViewMode = {
  List: 'list',
  Edit: 'edit',
} as const;
export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

export const FieldType = {
  Text: 'text',
  Cycle: 'cycle',
  Number: 'number',
  ReadOnly: 'readonly',
} as const;
export type FieldType = (typeof FieldType)[keyof typeof FieldType];

interface BaseFieldDef<T extends FieldType> {
  readonly key: string;
  readonly label: string;
  readonly type: T;
}

interface TextFieldDef extends BaseFieldDef<typeof FieldType.Text> {
  readonly type: typeof FieldType.Text;
}

interface CycleFieldDef extends BaseFieldDef<typeof FieldType.Cycle> {
  readonly type: typeof FieldType.Cycle;
  readonly options: readonly string[];
}

interface NumberFieldDef extends BaseFieldDef<typeof FieldType.Number> {
  readonly type: typeof FieldType.Number;
}

interface ReadOnlyFieldDef extends BaseFieldDef<typeof FieldType.ReadOnly> {
  readonly type: typeof FieldType.ReadOnly;
}

export type FieldDefinition = TextFieldDef | CycleFieldDef | NumberFieldDef | ReadOnlyFieldDef;

export interface KeyHint {
  readonly key: string;
  readonly action: string;
}
