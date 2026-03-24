import { Box, Text } from 'ink';
import type { Todo } from '../types.ts';
import { formatDuration } from '../../../core/date-utils.ts';
import { TimeEntryService } from '../time-entry-service.ts';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { TodoStatus } from '../../../core/types.ts';
import { TodoStatus as TodoStatusEnum } from '../../../core/types.ts';
import { StatusDot } from '../../../shared/tui/status-dot.tsx';

interface TodoListProps {
  readonly db: DrizzleDatabase;
  readonly todos: readonly Todo[];
  readonly selectedIndex: number;
}

const STATUS_COLORS: Record<TodoStatus, string> = {
  [TodoStatusEnum.Sketch]: 'gray',
  [TodoStatusEnum.Ready]: 'blue',
  [TodoStatusEnum.InProgress]: 'green',
  [TodoStatusEnum.Paused]: 'yellow',
  [TodoStatusEnum.Done]: 'cyan',
  [TodoStatusEnum.Cancelled]: 'red',
};

const ACTIVE_STATUSES = new Set<TodoStatus>([
  TodoStatusEnum.Ready,
  TodoStatusEnum.InProgress,
  TodoStatusEnum.Paused,
]);

function TodoRow({
  db,
  todo,
  isSelected,
}: {
  readonly db: DrizzleDatabase;
  readonly todo: Todo;
  readonly isSelected: boolean;
}) {
  const elapsed = TimeEntryService.totalElapsed(db, todo.id);
  const color = STATUS_COLORS[todo.status];
  const timeStr = elapsed > 0 ? ` ${formatDuration(elapsed)}` : '';
  const priorityStr = todo.priority ? ` [${todo.priority}]` : '';
  const dueStr = todo.due_date ? ` due:${todo.due_date}` : '';

  return (
    <Box>
      <Text bold={isSelected} inverse={isSelected}>
        {isSelected ? ' ▸ ' : '   '}
      </Text>
      <Text dimColor>#{todo.id} </Text>
      <StatusDot color={color} filled={ACTIVE_STATUSES.has(todo.status)} />
      <Text color={color} dimColor>
        {' '}
        {todo.status.padEnd(11)}{' '}
      </Text>
      <Text bold={isSelected}>{todo.title ?? todo.raw_input}</Text>
      <Text dimColor>{priorityStr}</Text>
      <Text dimColor>{dueStr}</Text>
      <Text color="yellow">{timeStr}</Text>
    </Box>
  );
}

export function TodoList({ db, todos, selectedIndex }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No todos match the current filters.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {todos.map((todo, idx) => (
        <TodoRow key={todo.id} db={db} todo={todo} isSelected={idx === selectedIndex} />
      ))}
    </Box>
  );
}
