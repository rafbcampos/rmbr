import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import { TilService } from '../service.ts';
import type { EditValues } from '../../../shared/tui/edit-form.tsx';
import { pickString } from '../../../shared/tui/edit-values.ts';
import { useTilList, useDomains } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { TilList } from './til-list.tsx';
import { KEY } from './keys.ts';
import { MasterDetail } from '../../../shared/tui/master-detail.tsx';
import { KeyHintBar } from '../../../shared/tui/key-hint-bar.tsx';
import { DetailPane } from '../../../shared/tui/detail-pane.tsx';
import { EditForm } from '../../../shared/tui/edit-form.tsx';
import { useViewMode } from '../../../shared/tui/use-view-mode.ts';
import { ViewMode } from '../../../shared/tui/types.ts';
import type { KeyHint } from '../../../shared/tui/types.ts';
import { TIL_DETAIL_FIELDS, TIL_EDIT_FIELDS } from './fields.ts';

const LIST_HINTS: readonly KeyHint[] = [
  { key: '↑↓', action: 'nav' },
  { key: 'e', action: 'edit' },
  { key: 'd', action: 'domain' },
  { key: 'q', action: 'quit' },
];

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
  const { mode, enterEdit, exitEdit } = useViewMode();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [domainIndex, setDomainIndex] = useState(0);

  const domains = useDomains(db);
  const domainOptions: readonly (string | undefined)[] = [undefined, ...domains];
  const domainFilter = domainOptions[domainIndex];

  const { tils, reload } = useTilList(db, domainFilter);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, tils.length - 1)),
    [tils.length],
  );

  const selectedTil = tils[selectedIndex] ?? null;

  const handleSave = useCallback(
    (values: EditValues) => {
      if (selectedTil === null) return;
      TilService.enrich(db, selectedTil.id, {
        title: pickString(values, 'title'),
        content: pickString(values, 'content'),
        domain: pickString(values, 'domain'),
        tags: pickString(values, 'tags'),
      });
      reload();
      exitEdit();
    },
    [db, selectedTil, reload, exitEdit],
  );

  useInput(
    (input, key) => {
      if (input === KEY.QUIT) {
        exit();
        return;
      }

      if (key.upArrow) {
        setSelectedIndex(i => clampIndex(i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex(i => clampIndex(i + 1));
        return;
      }

      if (input === KEY.DOMAIN_CYCLE) {
        setDomainIndex(i => (i + 1) % domainOptions.length);
        setSelectedIndex(0);
        return;
      }

      if (!selectedTil) return;

      if (input === KEY.EDIT) {
        enterEdit();
        return;
      }
    },
    { isActive: mode === ViewMode.List },
  );

  const detailContent =
    mode === ViewMode.Edit && selectedTil !== null ? (
      <EditForm
        fields={TIL_EDIT_FIELDS}
        initialValues={selectedTil}
        onSave={handleSave}
        onCancel={exitEdit}
      />
    ) : selectedTil !== null ? (
      <DetailPane fields={TIL_DETAIL_FIELDS} data={selectedTil} />
    ) : null;

  return (
    <Box flexDirection="column">
      <StatusBar domainFilter={domainFilter} />
      <MasterDetail
        listTitle="TIL"
        detailTitle={mode === ViewMode.Edit ? 'Edit' : 'Preview'}
        listPanel={<TilList tils={tils} selectedIndex={selectedIndex} />}
        detailPanel={detailContent}
      />
      <KeyHintBar hints={LIST_HINTS} />
    </Box>
  );
}

export async function renderTilApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
