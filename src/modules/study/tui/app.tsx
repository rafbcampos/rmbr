import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { StudyStatus } from '../../../core/types.ts';
import { StudyStatus as StudyStatusEnum } from '../../../core/types.ts';
import { StudyService } from '../service.ts';
import type { EditValues } from '../../../shared/tui/edit-form.tsx';
import { pickString, pickNumber } from '../../../shared/tui/edit-values.ts';
import { useStudyTopics, useStudyDomains, useNextQueued } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { StudyList } from './study-list.tsx';
import { KEY, STATUS_KEY_MAP } from './keys.ts';
import { MasterDetail } from '../../../shared/tui/master-detail.tsx';
import { KeyHintBar } from '../../../shared/tui/key-hint-bar.tsx';
import { DetailPane } from '../../../shared/tui/detail-pane.tsx';
import { EditForm } from '../../../shared/tui/edit-form.tsx';
import { useViewMode } from '../../../shared/tui/use-view-mode.ts';
import { ViewMode } from '../../../shared/tui/types.ts';
import type { KeyHint } from '../../../shared/tui/types.ts';
import { STUDY_DETAIL_FIELDS, STUDY_EDIT_FIELDS } from './fields.ts';

const LIST_HINTS: readonly KeyHint[] = [
  { key: '↑↓', action: 'nav' },
  { key: '⏎', action: 'start' },
  { key: 'c', action: 'complete' },
  { key: 'p', action: 'park' },
  { key: 'e', action: 'edit' },
  { key: 'd', action: 'domain' },
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
  const [statusFilter, setStatusFilter] = useState<StudyStatus | undefined>(undefined);
  const [domainIndex, setDomainIndex] = useState(0);

  const domains = useStudyDomains(db);
  const domainOrder: readonly (string | undefined)[] = [undefined, ...domains];
  const domainFilter = domainOrder[domainIndex];

  const { topics, reload } = useStudyTopics(db, statusFilter, domainFilter);
  const { topic: nextTopic, reload: reloadNext } = useNextQueued(db);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, topics.length - 1)),
    [topics.length],
  );

  const selectedTopic = topics[selectedIndex] ?? null;

  const handleSave = useCallback(
    (values: EditValues) => {
      if (selectedTopic === null) return;
      StudyService.enrich(db, selectedTopic.id, {
        title: pickString(values, 'title'),
        domain: pickString(values, 'domain'),
        goal_id: pickNumber(values, 'goal_id'),
      });
      reload();
      exitEdit();
    },
    [db, selectedTopic, reload, exitEdit],
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

      if (input === KEY.DOMAIN_CYCLE) {
        setDomainIndex(i => (i + 1) % domainOrder.length);
        setSelectedIndex(0);
        return;
      }

      if (!selectedTopic) return;

      if (input === KEY.EDIT) {
        enterEdit();
        return;
      }

      if (key.return) {
        if (
          selectedTopic.status === StudyStatusEnum.Queued ||
          selectedTopic.status === StudyStatusEnum.Parked
        ) {
          StudyService.transition(db, selectedTopic.id, StudyStatusEnum.InProgress);
          reload();
          reloadNext();
        }
        return;
      }

      if (input === KEY.COMPLETE) {
        if (selectedTopic.status === StudyStatusEnum.InProgress) {
          StudyService.transition(db, selectedTopic.id, StudyStatusEnum.Completed);
          reload();
          reloadNext();
          setSelectedIndex(i => clampIndex(i));
        }
        return;
      }

      if (input === KEY.PARK) {
        if (selectedTopic.status === StudyStatusEnum.InProgress) {
          StudyService.transition(db, selectedTopic.id, StudyStatusEnum.Parked);
          reload();
          reloadNext();
        }
        return;
      }
    },
    { isActive: mode === ViewMode.List },
  );

  const detailContent =
    mode === ViewMode.Edit && selectedTopic !== null ? (
      <EditForm
        fields={STUDY_EDIT_FIELDS}
        initialValues={selectedTopic}
        onSave={handleSave}
        onCancel={exitEdit}
      />
    ) : selectedTopic !== null ? (
      <DetailPane fields={STUDY_DETAIL_FIELDS} data={selectedTopic} />
    ) : null;

  return (
    <Box flexDirection="column">
      <StatusBar nextTopic={nextTopic} statusFilter={statusFilter} domainFilter={domainFilter} />
      <MasterDetail
        listTitle="Study"
        detailTitle={mode === ViewMode.Edit ? 'Edit' : 'Preview'}
        listPanel={<StudyList topics={topics} selectedIndex={selectedIndex} />}
        detailPanel={detailContent}
      />
      <KeyHintBar hints={LIST_HINTS} />
    </Box>
  );
}

export async function renderStudyApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
