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

interface AppProps {
  readonly db: DrizzleDatabase;
}

function App({ db }: AppProps) {
  const { exit } = useApp();
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

    if (input === KEY.PRIORITY_CYCLE) {
      setPriorityIndex(i => (i + 1) % PRIORITY_ORDER.length);
      setSelectedIndex(0);
      return;
    }

    const selectedTodo = todos[selectedIndex];
    if (!selectedTodo) return;

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
  });

  return (
    <Box flexDirection="column">
      <StatusBar
        db={db}
        activeEntry={activeEntry}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
      />
      <TodoList db={db} todos={todos} selectedIndex={selectedIndex} />
    </Box>
  );
}

export async function renderTodoApp(db: DrizzleDatabase): Promise<void> {
  const instance = render(<App db={db} />);
  await instance.waitUntilExit();
}
