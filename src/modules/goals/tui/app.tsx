import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { GoalStatus } from '../../../core/types.ts';
import { GoalStatus as GoalStatusEnum } from '../../../core/types.ts';
import { GoalService } from '../service.ts';
import { useGoals } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { GoalList } from './goal-list.tsx';
import { KEY, STATUS_KEY_MAP, QUARTER_ORDER } from './keys.ts';

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<GoalStatus | undefined>(undefined);
  const [quarterIndex, setQuarterIndex] = useState(0);
  const quarterFilter = QUARTER_ORDER[quarterIndex];

  const { goals, reload } = useGoals(db, statusFilter, quarterFilter);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, goals.length - 1)),
    [goals.length],
  );

  useInput((input, key) => {
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

    const selectedGoal = goals[selectedIndex];
    if (!selectedGoal) return;

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
  });

  return (
    <Box flexDirection="column">
      <StatusBar statusFilter={statusFilter} quarterFilter={quarterFilter} />
      <GoalList goals={goals} selectedIndex={selectedIndex} />
    </Box>
  );
}

export async function renderGoalApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
