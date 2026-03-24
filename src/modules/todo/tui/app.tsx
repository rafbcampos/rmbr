import { useState, useCallback } from 'react';
import { render, useInput, useApp, Box } from 'ink';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { TodoStatus } from '../../../core/types.ts';
import { TodoStatus as TodoStatusEnum } from '../../../core/types.ts';
import { TodoService } from '../service.ts';
import { useTodos, useActiveTimer } from './hooks.ts';
import { StatusBar } from './status-bar.tsx';
import { TodoList } from './todo-list.tsx';
import { KEY, STATUS_KEY_MAP, PRIORITY_ORDER } from './keys.ts';
import { MasterDetail } from '../../../shared/tui/master-detail.tsx';
import { KeyHintBar } from '../../../shared/tui/key-hint-bar.tsx';
import { DetailPane } from '../../../shared/tui/detail-pane.tsx';
import { EditForm } from '../../../shared/tui/edit-form.tsx';
import type { EditValues } from '../../../shared/tui/edit-form.tsx';
import { useViewMode } from '../../../shared/tui/use-view-mode.ts';
import { ViewMode } from '../../../shared/tui/types.ts';
import type { KeyHint } from '../../../shared/tui/types.ts';
import { pickString, pickNumber } from '../../../shared/tui/edit-values.ts';
import { isTodoPriority } from '../types.ts';
import { TODO_DETAIL_FIELDS, TODO_EDIT_FIELDS } from './fields.ts';

const LIST_HINTS: readonly KeyHint[] = [
  { key: '↑↓', action: 'nav' },
  { key: '⏎', action: 'start' },
  { key: '␣', action: 'pause' },
  { key: 'd', action: 'done' },
  { key: 'e', action: 'edit' },
  { key: 'p', action: 'priority' },
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
  const [statusFilter, setStatusFilter] = useState<TodoStatus | undefined>(undefined);
  const [priorityIndex, setPriorityIndex] = useState(0);
  const priorityFilter = PRIORITY_ORDER[priorityIndex];

  const { todos, reload } = useTodos(db, statusFilter, priorityFilter);
  const activeEntry = useActiveTimer(db);

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, todos.length - 1)),
    [todos.length],
  );

  const selectedTodo = todos[selectedIndex] ?? null;

  const handleSave = useCallback(
    (values: EditValues) => {
      if (selectedTodo === null) return;
      const priorityStr = pickString(values, 'priority');
      const priority =
        priorityStr !== undefined && isTodoPriority(priorityStr) ? priorityStr : undefined;
      TodoService.enrich(db, selectedTodo.id, {
        title: pickString(values, 'title'),
        priority,
        due_date: pickString(values, 'due_date'),
        goal_id: pickNumber(values, 'goal_id'),
      });
      reload();
      exitEdit();
    },
    [db, selectedTodo, reload, exitEdit],
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

      if (input === KEY.PRIORITY_CYCLE) {
        setPriorityIndex(i => (i + 1) % PRIORITY_ORDER.length);
        setSelectedIndex(0);
        return;
      }

      if (!selectedTodo) return;

      if (input === KEY.EDIT) {
        enterEdit();
        return;
      }

      if (key.return) {
        if (
          selectedTodo.status === TodoStatusEnum.Ready ||
          selectedTodo.status === TodoStatusEnum.Paused
        ) {
          TodoService.transition(db, selectedTodo.id, TodoStatusEnum.InProgress);
          reload();
        }
        return;
      }

      if (input === ' ') {
        if (selectedTodo.status === TodoStatusEnum.InProgress) {
          TodoService.transition(db, selectedTodo.id, TodoStatusEnum.Paused);
          reload();
        } else if (selectedTodo.status === TodoStatusEnum.Paused) {
          TodoService.transition(db, selectedTodo.id, TodoStatusEnum.InProgress);
          reload();
        }
        return;
      }

      if (input === KEY.DONE) {
        if (
          selectedTodo.status === TodoStatusEnum.InProgress ||
          selectedTodo.status === TodoStatusEnum.Paused
        ) {
          TodoService.transition(db, selectedTodo.id, TodoStatusEnum.Done);
          reload();
          setSelectedIndex(i => clampIndex(i));
        }
        return;
      }
    },
    { isActive: mode === ViewMode.List },
  );

  const detailContent =
    mode === ViewMode.Edit && selectedTodo !== null ? (
      <EditForm
        fields={TODO_EDIT_FIELDS}
        initialValues={selectedTodo}
        onSave={handleSave}
        onCancel={exitEdit}
      />
    ) : selectedTodo !== null ? (
      <DetailPane fields={TODO_DETAIL_FIELDS} data={selectedTodo} />
    ) : null;

  return (
    <Box flexDirection="column">
      <StatusBar
        db={db}
        activeEntry={activeEntry}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
      />
      <MasterDetail
        listTitle="Todos"
        detailTitle={mode === ViewMode.Edit ? 'Edit' : 'Preview'}
        listPanel={<TodoList db={db} todos={todos} selectedIndex={selectedIndex} />}
        detailPanel={detailContent}
      />
      <KeyHintBar hints={LIST_HINTS} />
    </Box>
  );
}

export async function renderTodoApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
