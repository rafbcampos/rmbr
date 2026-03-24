import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import { SlackService } from '../service.ts';
import { useSlackMessages } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { SlackList } from './slack-list.tsx';
import { KEY, PROCESSED_KEY_MAP, SENTIMENT_ORDER } from './keys.ts';

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [processedFilter, setProcessedFilter] = useState<number | undefined>(undefined);
  const [sentimentIndex, setSentimentIndex] = useState(0);
  const sentimentFilter = SENTIMENT_ORDER[sentimentIndex];

  const { messages, reload } = useSlackMessages(db, processedFilter, sentimentFilter);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, messages.length - 1)),
    [messages.length],
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

    if (Object.hasOwn(PROCESSED_KEY_MAP, input)) {
      const newFilter = PROCESSED_KEY_MAP[input];
      setProcessedFilter(newFilter);
      setSelectedIndex(0);
      return;
    }

    if (input === KEY.SENTIMENT_CYCLE) {
      setSentimentIndex(i => (i + 1) % SENTIMENT_ORDER.length);
      setSelectedIndex(0);
      return;
    }

    const selectedMsg = messages[selectedIndex];
    if (!selectedMsg) return;

    if (key.return) {
      if (selectedMsg.processed === 0) {
        SlackService.markProcessed(db, selectedMsg.id);
        reload();
      }
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <StatusBar processedFilter={processedFilter} sentimentFilter={sentimentFilter} />
      <SlackList messages={messages} selectedIndex={selectedIndex} />
    </Box>
  );
}

export async function renderSlackApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
