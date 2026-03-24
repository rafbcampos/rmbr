import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { KudosDirection } from '../../../core/types.ts';
import { KudosService } from '../service.ts';
import { isKudosDirection } from '../types.ts';
import type { EditValues } from '../../../shared/tui/edit-form.tsx';
import { pickString, pickNumber } from '../../../shared/tui/edit-values.ts';
import { useKudosList } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { KudosList } from './kudos-list.tsx';
import { KEY, DIRECTION_KEY_MAP } from './keys.ts';
import { MasterDetail } from '../../../shared/tui/master-detail.tsx';
import { KeyHintBar } from '../../../shared/tui/key-hint-bar.tsx';
import { DetailPane } from '../../../shared/tui/detail-pane.tsx';
import { EditForm } from '../../../shared/tui/edit-form.tsx';
import { useViewMode } from '../../../shared/tui/use-view-mode.ts';
import { ViewMode } from '../../../shared/tui/types.ts';
import type { KeyHint } from '../../../shared/tui/types.ts';
import { KUDOS_DETAIL_FIELDS, KUDOS_EDIT_FIELDS } from './fields.ts';

const LIST_HINTS: readonly KeyHint[] = [
  { key: '↑↓', action: 'nav' },
  { key: 'e', action: 'edit' },
  { key: '1-3', action: 'filter' },
  { key: 'q', action: 'quit' },
];

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
  const { mode, enterEdit, exitEdit } = useViewMode();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [directionFilter, setDirectionFilter] = useState<KudosDirection | undefined>(undefined);

  const { kudos, reload } = useKudosList(db, directionFilter);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, kudos.length - 1)),
    [kudos.length],
  );

  const selectedKudos = kudos[selectedIndex] ?? null;

  const handleSave = useCallback(
    (values: EditValues) => {
      if (selectedKudos === null) return;
      const dirStr = pickString(values, 'direction');
      const direction = dirStr !== undefined && isKudosDirection(dirStr) ? dirStr : undefined;
      KudosService.enrich(db, selectedKudos.id, {
        direction,
        person: pickString(values, 'person'),
        summary: pickString(values, 'summary'),
        context: pickString(values, 'context'),
        goal_id: pickNumber(values, 'goal_id'),
      });
      reload();
      exitEdit();
    },
    [db, selectedKudos, reload, exitEdit],
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

      if (Object.hasOwn(DIRECTION_KEY_MAP, input)) {
        const newFilter = DIRECTION_KEY_MAP[input];
        setDirectionFilter(newFilter);
        setSelectedIndex(0);
        return;
      }

      if (!selectedKudos) return;

      if (input === KEY.EDIT) {
        enterEdit();
        return;
      }
    },
    { isActive: mode === ViewMode.List },
  );

  const detailContent =
    mode === ViewMode.Edit && selectedKudos !== null ? (
      <EditForm
        fields={KUDOS_EDIT_FIELDS}
        initialValues={selectedKudos}
        onSave={handleSave}
        onCancel={exitEdit}
      />
    ) : selectedKudos !== null ? (
      <DetailPane fields={KUDOS_DETAIL_FIELDS} data={selectedKudos} />
    ) : null;

  return (
    <Box flexDirection="column">
      <StatusBar directionFilter={directionFilter} />
      <MasterDetail
        listTitle="Kudos"
        detailTitle={mode === ViewMode.Edit ? 'Edit' : 'Preview'}
        listPanel={<KudosList kudos={kudos} selectedIndex={selectedIndex} />}
        detailPanel={detailContent}
      />
      <KeyHintBar hints={LIST_HINTS} />
    </Box>
  );
}

export async function renderKudosApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
