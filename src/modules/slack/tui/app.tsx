import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import { SlackService } from '../service.ts';
import { isSlackSentiment } from '../types.ts';
import type { EditValues } from '../../../shared/tui/edit-form.tsx';
import { pickString, pickNumber } from '../../../shared/tui/edit-values.ts';
import { useSlackMessages } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { SlackList } from './slack-list.tsx';
import { KEY, PROCESSED_KEY_MAP, SENTIMENT_ORDER } from './keys.ts';
import { MasterDetail } from '../../../shared/tui/master-detail.tsx';
import { KeyHintBar } from '../../../shared/tui/key-hint-bar.tsx';
import { DetailPane } from '../../../shared/tui/detail-pane.tsx';
import { EditForm } from '../../../shared/tui/edit-form.tsx';
import { useViewMode } from '../../../shared/tui/use-view-mode.ts';
import { ViewMode } from '../../../shared/tui/types.ts';
import type { KeyHint } from '../../../shared/tui/types.ts';
import { SLACK_DETAIL_FIELDS, SLACK_EDIT_FIELDS } from './fields.ts';

const LIST_HINTS: readonly KeyHint[] = [
  { key: '↑↓', action: 'nav' },
  { key: '⏎', action: 'process' },
  { key: 'e', action: 'edit' },
  { key: 's', action: 'sentiment' },
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
  const [processedFilter, setProcessedFilter] = useState<number | undefined>(undefined);
  const [sentimentIndex, setSentimentIndex] = useState(0);
  const sentimentFilter = SENTIMENT_ORDER[sentimentIndex];

  const { messages, reload } = useSlackMessages(db, processedFilter, sentimentFilter);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, messages.length - 1)),
    [messages.length],
  );

  const selectedMsg = messages[selectedIndex] ?? null;

  const handleSave = useCallback(
    (values: EditValues) => {
      if (selectedMsg === null) return;
      const sentimentStr = pickString(values, 'sentiment');
      const sentiment =
        sentimentStr !== undefined && isSlackSentiment(sentimentStr) ? sentimentStr : null;
      if (sentiment !== null) {
        SlackService.setSentiment(db, selectedMsg.id, sentiment);
      }
      const todoId = pickNumber(values, 'todo_id');
      if (todoId !== undefined) {
        SlackService.linkTodo(db, selectedMsg.id, todoId);
      }
      const goalId = pickNumber(values, 'goal_id');
      if (goalId !== undefined) {
        SlackService.linkGoal(db, selectedMsg.id, goalId);
      }
      reload();
      exitEdit();
    },
    [db, selectedMsg, reload, exitEdit],
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

      if (!selectedMsg) return;

      if (input === KEY.EDIT) {
        enterEdit();
        return;
      }

      if (key.return) {
        if (selectedMsg.processed === 0) {
          SlackService.markProcessed(db, selectedMsg.id);
          reload();
        }
        return;
      }
    },
    { isActive: mode === ViewMode.List },
  );

  const detailContent =
    mode === ViewMode.Edit && selectedMsg !== null ? (
      <EditForm
        fields={SLACK_EDIT_FIELDS}
        initialValues={selectedMsg}
        onSave={handleSave}
        onCancel={exitEdit}
      />
    ) : selectedMsg !== null ? (
      <DetailPane fields={SLACK_DETAIL_FIELDS} data={selectedMsg} />
    ) : null;

  return (
    <Box flexDirection="column">
      <StatusBar processedFilter={processedFilter} sentimentFilter={sentimentFilter} />
      <MasterDetail
        listTitle="Slack"
        detailTitle={mode === ViewMode.Edit ? 'Edit' : 'Preview'}
        listPanel={<SlackList messages={messages} selectedIndex={selectedIndex} />}
        detailPanel={detailContent}
      />
      <KeyHintBar hints={LIST_HINTS} />
    </Box>
  );
}

export async function renderSlackApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
