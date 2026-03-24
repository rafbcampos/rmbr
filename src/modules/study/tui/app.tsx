import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { StudyStatus } from '../../../core/types.ts';
import { StudyStatus as StudyStatusEnum } from '../../../core/types.ts';
import { StudyService } from '../service.ts';
import { useStudyTopics, useStudyDomains, useNextQueued } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { StudyList } from './study-list.tsx';
import { KEY, STATUS_KEY_MAP } from './keys.ts';

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
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

    if (input === KEY.DOMAIN_CYCLE) {
      setDomainIndex(i => (i + 1) % domainOrder.length);
      setSelectedIndex(0);
      return;
    }

    const selectedTopic = topics[selectedIndex];
    if (!selectedTopic) return;

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
  });

  return (
    <Box flexDirection="column">
      <StatusBar nextTopic={nextTopic} statusFilter={statusFilter} domainFilter={domainFilter} />
      <StudyList topics={topics} selectedIndex={selectedIndex} />
    </Box>
  );
}

export async function renderStudyApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
