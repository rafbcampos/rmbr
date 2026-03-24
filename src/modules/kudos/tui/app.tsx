import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { KudosDirection } from '../../../core/types.ts';
import { useKudosList } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { KudosList } from './kudos-list.tsx';
import { KEY, DIRECTION_KEY_MAP } from './keys.ts';

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [directionFilter, setDirectionFilter] = useState<KudosDirection | undefined>(undefined);

  const { kudos } = useKudosList(db, directionFilter);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, kudos.length - 1)),
    [kudos.length],
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

    if (Object.hasOwn(DIRECTION_KEY_MAP, input)) {
      const newFilter = DIRECTION_KEY_MAP[input];
      setDirectionFilter(newFilter);
      setSelectedIndex(0);
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <StatusBar directionFilter={directionFilter} />
      <KudosList kudos={kudos} selectedIndex={selectedIndex} />
    </Box>
  );
}

export async function renderKudosApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
