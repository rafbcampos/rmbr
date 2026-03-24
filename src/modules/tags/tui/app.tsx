import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import { EntityType } from '../types.ts';
import type { EntityType as EntityTypeValue } from '../types.ts';
import { useTagList, useTagEntities } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { TagList } from './tag-list.tsx';
import { EntityList } from './entity-list.tsx';
import { TagView } from './types.ts';
import { KEY } from './keys.ts';
import { BorderedPanel } from '../../../shared/tui/bordered-panel.tsx';
import { KeyHintBar } from '../../../shared/tui/key-hint-bar.tsx';
import type { KeyHint } from '../../../shared/tui/types.ts';

const ENTITY_TYPE_ORDER: ReadonlyArray<EntityTypeValue | undefined> = [
  undefined,
  EntityType.Todo,
  EntityType.Kudos,
  EntityType.Goal,
  EntityType.Til,
  EntityType.Study,
  EntityType.Slack,
];

const TAG_LIST_HINTS: readonly KeyHint[] = [
  { key: '↑↓', action: 'nav' },
  { key: '⏎', action: 'select' },
  { key: 'q', action: 'quit' },
];

const ENTITY_LIST_HINTS: readonly KeyHint[] = [
  { key: '↑↓', action: 'nav' },
  { key: 't', action: 'type' },
  { key: 'Esc', action: 'back' },
  { key: 'q', action: 'quit' },
];

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
  const [view, setView] = useState<TagView>(TagView.List);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  const [selectedEntityIndex, setSelectedEntityIndex] = useState(0);
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const [entityTypeIndex, setEntityTypeIndex] = useState(0);

  const entityTypeFilter = ENTITY_TYPE_ORDER[entityTypeIndex];

  const { tags } = useTagList(db);
  const { entities } = useTagEntities(
    db,
    view === TagView.Entities ? selectedTagName : null,
    entityTypeFilter,
  );

  const clampTagIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, tags.length - 1)),
    [tags.length],
  );

  const clampEntityIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, entities.length - 1)),
    [entities.length],
  );

  useInput((input, key) => {
    if (input === KEY.QUIT) {
      exit();
      return;
    }

    if (view === TagView.List) {
      if (key.upArrow) {
        setSelectedTagIndex(i => clampTagIndex(i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedTagIndex(i => clampTagIndex(i + 1));
        return;
      }
      if (key.return) {
        const tag = tags[selectedTagIndex];
        if (tag) {
          setSelectedTagName(tag.name);
          setSelectedEntityIndex(0);
          setEntityTypeIndex(0);
          setView(TagView.Entities);
        }
        return;
      }
    }

    if (view === TagView.Entities) {
      if (key.upArrow) {
        setSelectedEntityIndex(i => clampEntityIndex(i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedEntityIndex(i => clampEntityIndex(i + 1));
        return;
      }
      if (key.escape) {
        setSelectedTagName(null);
        setSelectedEntityIndex(0);
        setEntityTypeIndex(0);
        setView(TagView.List);
        return;
      }
      if (input === KEY.TYPE_CYCLE) {
        setEntityTypeIndex(i => (i + 1) % ENTITY_TYPE_ORDER.length);
        setSelectedEntityIndex(0);
        return;
      }
    }
  });

  return (
    <Box flexDirection="column">
      <StatusBar view={view} tagName={selectedTagName} entityTypeFilter={entityTypeFilter} />
      <BorderedPanel title={view === TagView.List ? 'Tags' : `Tag: ${selectedTagName}`}>
        {view === TagView.List && <TagList tags={tags} selectedIndex={selectedTagIndex} />}
        {view === TagView.Entities && selectedTagName !== null && (
          <EntityList
            tagName={selectedTagName}
            entities={entities}
            selectedIndex={selectedEntityIndex}
          />
        )}
      </BorderedPanel>
      <KeyHintBar hints={view === TagView.List ? TAG_LIST_HINTS : ENTITY_LIST_HINTS} />
    </Box>
  );
}

export async function renderTagApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
