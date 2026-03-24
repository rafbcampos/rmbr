import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import { useTilList, useDomains } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { TilList } from './til-list.tsx';
import { KEY } from './keys.ts';

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [domainIndex, setDomainIndex] = useState(0);

  const domains = useDomains(db);
  const domainOptions: readonly (string | undefined)[] = [undefined, ...domains];
  const domainFilter = domainOptions[domainIndex];

  const { tils } = useTilList(db, domainFilter);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, tils.length - 1)),
    [tils.length],
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

    if (input === KEY.DOMAIN_CYCLE) {
      setDomainIndex(i => (i + 1) % domainOptions.length);
      setSelectedIndex(0);
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <StatusBar domainFilter={domainFilter} />
      <TilList tils={tils} selectedIndex={selectedIndex} />
    </Box>
  );
}

export async function renderTilApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
