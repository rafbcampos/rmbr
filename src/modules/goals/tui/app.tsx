import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { GoalStatus } from '../../../core/types.ts';
import { GoalStatus as GoalStatusEnum } from '../../../core/types.ts';
import { GoalService } from '../service.ts';
import { isQuarter } from '../types.ts';
import type { EditValues } from '../../../shared/tui/edit-form.tsx';
import { pickString, pickNumber } from '../../../shared/tui/edit-values.ts';
import { useGoals } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { GoalList } from './goal-list.tsx';
import { KEY, STATUS_KEY_MAP, QUARTER_ORDER } from './keys.ts';
import { MasterDetail } from '../../../shared/tui/master-detail.tsx';
import { KeyHintBar } from '../../../shared/tui/key-hint-bar.tsx';
import { DetailPane } from '../../../shared/tui/detail-pane.tsx';
import { EditForm } from '../../../shared/tui/edit-form.tsx';
import { useViewMode } from '../../../shared/tui/use-view-mode.ts';
import { ViewMode } from '../../../shared/tui/types.ts';
import type { KeyHint } from '../../../shared/tui/types.ts';
import { GOAL_DETAIL_FIELDS, GOAL_EDIT_FIELDS } from './fields.ts';

const LIST_HINTS: readonly KeyHint[] = [
  { key: '↑↓', action: 'nav' },
  { key: '⏎', action: 'activate' },
  { key: 'd', action: 'complete' },
  { key: 'a', action: 'abandon' },
  { key: 'e', action: 'edit' },
  { key: 'r', action: 'quarter' },
  { key: '1-5', action: 'status' },
  { key: 'q', action: 'quit' },
];

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
  const { mode, enterEdit, exitEdit } = useViewMode();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<GoalStatus | undefined>(undefined);
  const [quarterIndex, setQuarterIndex] = useState(0);
  const quarterFilter = QUARTER_ORDER[quarterIndex];

  const { goals, reload } = useGoals(db, statusFilter, quarterFilter);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, goals.length - 1)),
    [goals.length],
  );

  const selectedGoal = goals[selectedIndex] ?? null;

  const handleSave = useCallback(
    (values: EditValues) => {
      if (selectedGoal === null) return;
      const quarterStr = pickString(values, 'quarter');
      const quarter = quarterStr !== undefined && isQuarter(quarterStr) ? quarterStr : undefined;
      GoalService.enrich(db, selectedGoal.id, {
        title: pickString(values, 'title'),
        quarter,
        year: pickNumber(values, 'year'),
        kpis: pickString(values, 'kpis'),
      });
      reload();
      exitEdit();
    },
    [db, selectedGoal, reload, exitEdit],
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

      if (Object.hasOwn(STATUS_KEY_MAP, input)) {
        const newFilter = STATUS_KEY_MAP[input];
        setStatusFilter(newFilter);
        setSelectedIndex(0);
        return;
      }

      if (input === KEY.QUARTER_CYCLE) {
        setQuarterIndex(i => (i + 1) % QUARTER_ORDER.length);
        setSelectedIndex(0);
        return;
      }

      if (!selectedGoal) return;

      if (input === KEY.EDIT) {
        enterEdit();
        return;
      }

      if (key.return) {
        if (selectedGoal.status === GoalStatusEnum.Draft) {
          GoalService.transition(db, selectedGoal.id, GoalStatusEnum.Active);
          reload();
        }
        return;
      }

      if (input === KEY.COMPLETE) {
        if (selectedGoal.status === GoalStatusEnum.Active) {
          GoalService.transition(db, selectedGoal.id, GoalStatusEnum.Completed);
          reload();
          setSelectedIndex(i => clampIndex(i));
        }
        return;
      }

      if (input === KEY.ABANDON) {
        if (selectedGoal.status === GoalStatusEnum.Active) {
          GoalService.transition(db, selectedGoal.id, GoalStatusEnum.Abandoned);
          reload();
          setSelectedIndex(i => clampIndex(i));
        }
        return;
      }
    },
    { isActive: mode === ViewMode.List },
  );

  const detailContent =
    mode === ViewMode.Edit && selectedGoal !== null ? (
      <EditForm
        fields={GOAL_EDIT_FIELDS}
        initialValues={selectedGoal}
        onSave={handleSave}
        onCancel={exitEdit}
      />
    ) : selectedGoal !== null ? (
      <DetailPane fields={GOAL_DETAIL_FIELDS} data={selectedGoal} />
    ) : null;

  return (
    <Box flexDirection="column">
      <StatusBar statusFilter={statusFilter} quarterFilter={quarterFilter} />
      <MasterDetail
        listTitle="Goals"
        detailTitle={mode === ViewMode.Edit ? 'Edit' : 'Preview'}
        listPanel={<GoalList goals={goals} selectedIndex={selectedIndex} />}
        detailPanel={detailContent}
      />
      <KeyHintBar hints={LIST_HINTS} />
    </Box>
  );
}

export async function renderGoalApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
