# Todo Time Tracking, Interactive TUI & Estimation

## Context

rmbr tracks todos but has no visibility into how long tasks take. Without time data, standups are guesswork ("I worked on X... for a while"), estimation is impossible, and retrospectives lack quantitative grounding. This design adds time tracking to the todo module with a hybrid UX: an interactive Ink TUI for browsing/selecting tasks, background timers via DB timestamps, and LLM-assisted estimation from historical duration data.

## Design Decisions

| Decision        | Choice                                          | Rationale                                                    |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Timer UX        | Hybrid (TUI browse + background timer)          | Terminal stays free; no daemon process                       |
| Storage         | Session log table (`todo_time_entries`)         | Granular per-session data; supports pattern analysis         |
| TUI library     | Ink v5 (React for CLI)                          | Composable, mature, good DX                                  |
| Estimation      | LLM-assisted via MCP tool                       | No built-in algorithm; expose data, let LLM judge similarity |
| Skills          | Replace weekly-standup with standup + new retro | User-defined intervals, no hardcoded cadence                 |
| Backward compat | Not needed                                      | Library not published                                        |

## Data Layer

### Migration 103: `todo_time_entries`

```sql
-- up
CREATE TABLE todo_time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL REFERENCES todos(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  stopped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_todo_time_entries_todo_id ON todo_time_entries(todo_id);
CREATE INDEX idx_todo_time_entries_running ON todo_time_entries(stopped_at) WHERE stopped_at IS NULL;

-- down
DROP INDEX IF EXISTS idx_todo_time_entries_running;
DROP INDEX IF EXISTS idx_todo_time_entries_todo_id;
DROP TABLE IF EXISTS todo_time_entries;
```

### Timer Mechanism

No daemon. A running timer is a row with `stopped_at IS NULL`. Elapsed time is computed on read: `now() - started_at + SUM(previous completed sessions)`. Terminal close leaves the timer running; user explicitly pauses/stops.

### Types

```typescript
// src/core/types.ts — add branded type
export type TimeEntryId = Brand<number, 'TimeEntryId'>;

// src/modules/todo/types.ts — add interfaces
export interface TimeEntry {
  readonly id: TimeEntryId;
  readonly todo_id: TodoId;
  readonly started_at: string;
  readonly stopped_at: string | null;
  readonly duration_seconds: number; // computed at mapping time
  readonly created_at: string;
}

export interface TodoWithTime extends Todo {
  readonly total_elapsed_seconds: number;
  readonly active_entry_id: TimeEntryId | null;
}

// Row type from DB
export interface TimeEntryRow {
  readonly id: number;
  readonly todo_id: number;
  readonly started_at: string;
  readonly stopped_at: string | null;
  readonly created_at: string;
}

// Mapper function
export function timeEntryRowToEntity(row: TimeEntryRow): TimeEntry {
  const startMs = Date.parse(row.started_at);
  const stopMs = row.stopped_at !== null ? Date.parse(row.stopped_at) : Date.now();
  return {
    id: row.id as TimeEntryId,
    todo_id: row.todo_id as TodoId,
    started_at: row.started_at,
    stopped_at: row.stopped_at,
    duration_seconds: Math.floor((stopMs - startMs) / 1000),
    created_at: row.created_at,
  };
}
```

`TodoWithTime` is not stored — it's assembled in `TodoService.getByIdWithTime()` by combining a `Todo` with aggregated time entry data. No separate row mapper needed.

### Drizzle Schema

```typescript
// src/modules/todo/drizzle-schema.ts — add table
export const todoTimeEntries = sqliteTable('todo_time_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  todo_id: integer('todo_id').notNull(),
  started_at: text('started_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  stopped_at: text('stopped_at'),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
```

## Service Layer

### `TimeEntryService` (new file: `src/modules/todo/time-entry-service.ts`)

| Method                                   | Behavior                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `start(db, todoId)`                      | Insert entry; throw `ValidationError` if todo already has a running entry |
| `stop(db, todoId)`                       | Set `stopped_at`; throw `ValidationError` if no running entry             |
| `stopAll(db)`                            | Stop all running entries across all todos; return count stopped           |
| `getActive(db, todoId)`                  | Running entry for a specific todo, or null                                |
| `getAnyActive(db)`                       | Any running entry across all todos, or null                               |
| `getRunningCount(db)`                    | Count of todos with running entries (for multi-timer detection)           |
| `listForTodo(db, todoId)`                | All entries for a todo, ordered by `started_at` desc                      |
| `totalElapsed(db, todoId)`               | SUM via `julianday()` arithmetic, floored to integer seconds              |
| `getCompletedWithDuration(db, filters?)` | Done todos (not soft-deleted) + aggregated duration for estimation        |

Duration computation uses SQLite's `julianday()`:

```sql
SUM(CASE
  WHEN stopped_at IS NOT NULL THEN (julianday(stopped_at) - julianday(started_at)) * 86400
  ELSE (julianday('now') - julianday(started_at)) * 86400
END)
```

`getCompletedWithDuration` joins against `todos` and filters `deleted_at IS NULL` to exclude soft-deleted todos.

### Modified `TodoService.transition()`

After `handleTransition()` succeeds, time-entry side effects fire:

- Transition to `TodoStatus.InProgress`: start timer if none running for this todo
- Transition to `TodoStatus.Paused` / `TodoStatus.Done` / `TodoStatus.Cancelled`: stop timer if one running

Uses `TodoStatus` constants throughout (no hardcoded strings).

New method: `TodoService.getByIdWithTime(db, id)`:

```typescript
getByIdWithTime(db: DrizzleDatabase, id: number): TodoWithTime {
  const todo = TodoService.getById(db, id);
  const totalElapsed = TimeEntryService.totalElapsed(db, id);
  const activeEntry = TimeEntryService.getActive(db, id);
  return {
    ...todo,
    total_elapsed_seconds: totalElapsed,
    active_entry_id: activeEntry ? activeEntry.id : null,
  };
}
```

### `formatDuration()` helper

Added to `src/core/date-utils.ts`:

- `formatDuration(0)` → `"0s"`
- `formatDuration(45)` → `"45s"`
- `formatDuration(312)` → `"5m 12s"`
- `formatDuration(9240)` → `"2h 34m"`
- `formatDuration(90061)` → `"25h 1m"` (no day rollover — hours accumulate)
- Negative values → `"0s"` (clamp)

## CLI Commands

### Modified

| Command                 | Change                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `rmbr todo start <id>`  | Prints timer started confirmation with current elapsed if resuming                                                  |
| `rmbr todo pause [id]`  | id optional; auto-finds active timer. Errors if 0 or 2+ running — prints which todos are active so user can specify |
| `rmbr todo done [id]`   | id optional; same multi-timer behavior as pause. Shows total duration on completion                                 |
| `rmbr todo show <id>`   | Session breakdown + total time                                                                                      |
| `rmbr todo cancel <id>` | Stops timer if running (handled by transition side effects)                                                         |

**Multi-timer behavior for optional-id commands**: `getRunningCount(db)` checks how many are running. If 0 → error "No active timer". If 1 → use that todo. If 2+ → error listing the active todo IDs so the user can specify.

### `rmbr todo list` — Two Clients

The CLI serves two clients: humans (interactive terminal) and AI agents (Claude Code, scripts).

**Default (human)**: Launches Ink TUI when stdout is a TTY and `--ai` is not passed.

**AI mode** (`--ai` flag): Plain text/JSON output optimized for machine consumption. No interactive elements. Includes elapsed time data. This is what AI agents use when calling the CLI directly (MCP tools are the primary AI interface, but `--ai` covers CLI-based agent workflows).

**Piped/redirected**: Plain text output (same as `--ai`). Detected via `!process.stdout.isTTY`.

Decision logic:

```
if --ai flag OR !process.stdout.isTTY → plain text output with time data
else → Ink TUI
```

This pattern (`--ai` flag for machine-friendly output) should be established as a convention for future TUI commands across other modules.

### Ink TUI

```
src/modules/todo/tui/
  app.tsx          — Root Ink app
  todo-list.tsx    — Scrollable filterable list
  status-bar.tsx   — Active timer display + keybindings footer
  hooks.ts         — useTimer, useTodos, useActiveTimer
  keys.ts          — Key binding constants
```

**Keybindings:**
| Key | Action |
|-----|--------|
| Up/Down | Navigate list |
| Enter | Start selected todo (→ in_progress, creates time entry) |
| Space | Pause/resume active task |
| d | Mark selected as done |
| 1-5 | Status filter tabs |
| p | Priority filter cycle |
| q | Exit to shell (timer keeps running) |

**Display:**

- Active task pinned at top with live counter (ticks every second via `setInterval`)
- Each row: `#id [status] title priority due_date elapsed`
- Active todo highlighted distinctly

**Technical notes:**

- Dynamic `import('ink')` in the list command to keep non-TUI CLI fast
- New deps: `ink` v5, `react` 18

**TSConfig changes:**

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "bin/**/*.ts", "tests/**/*.ts"]
}
```

## MCP Tools

### Enhanced

| Tool                   | Change                                                  |
| ---------------------- | ------------------------------------------------------- |
| `rmbr_todo_list`       | Each todo includes `total_elapsed_seconds`              |
| `rmbr_todo_get`        | Includes `time_entries` array + `total_elapsed_seconds` |
| `rmbr_todo_transition` | Timer management via service layer (automatic)          |

### New: `rmbr_todo_estimate`

Returns completed (non-deleted) todos with actual duration for LLM similarity matching.

```typescript
{
  name: 'rmbr_todo_estimate',
  description: 'Returns completed todos with their actual duration. Use to estimate new todos by finding similar completed work.',
  schema: {
    goal_id: z.number().optional().describe('Filter by goal ID'),
    priority: z.string().optional().describe('Filter by priority: low, medium, high, critical'),
    limit: z.number().optional().describe('Max results (default 50)'),
  },
}
```

Response: title, priority, goal_id, total_elapsed_seconds per completed todo. The LLM compares against the new todo's description and suggests an estimate.

## Skills

### Replace: `src/skills/weekly-standup/` → `src/skills/standup/SKILL.md`

Delete `src/skills/weekly-standup/SKILL.md`. Create `src/skills/standup/SKILL.md`.

The user defines the standup interval (daily, every other day, weekly, etc.). The skill asks the user for the period to cover rather than assuming "this week".

Workflow:

1. Ask the user what period to cover (e.g., "since yesterday", "this week", "since last Monday")
2. Query `rmbr_todo_list` with status `done` — completed in the period
3. Query `rmbr_todo_list` with status `in_progress` — current work
4. Query `rmbr_todo_list` with status `paused` — blockers
5. For each relevant todo, use `rmbr_todo_get` to include elapsed time
6. Query `rmbr_goal_list` with status `active` — goals for context
7. Query `rmbr_kudos_list` — recent kudos
8. Query `rmbr_til_list` — recent learnings
9. Synthesize: **Done** (with time: "Completed X (2h 30m)"), **In Progress** (with time so far), **Blockers**, **Highlights** (kudos, TILs)
10. Present formatted standup for user to copy/adjust

### New: `src/skills/retro/SKILL.md`

User defines when retros occur (weekly, bi-weekly, sprint-based, etc.). The skill asks for the period.

Workflow:

1. Ask the user what period to review (e.g., "this sprint", "last two weeks", "this month")
2. Query `rmbr_todo_estimate` for completed todos with duration in that period
3. Query `rmbr_goal_list` for active goals
4. For each completed todo, get session breakdown via `rmbr_todo_get`
5. Analyze: total time tracked, time per goal, largest time sinks, average task duration by priority
6. If LLM previously provided estimates, compare estimate vs actual
7. Format: Summary, Time Distribution by Goal, Completed Work, Estimation Accuracy, Insights
8. Present for user to review and adjust

## Testing Strategy

### New: `tests/modules/todo/time-entry-service.test.ts`

- `start()`: creates entry with `started_at` set and `stopped_at` null
- `start()`: throws when todo already has running entry
- `stop()`: sets `stopped_at` on running entry
- `stop()`: throws when no running entry exists
- `stopAll()`: stops all running entries, returns count
- `getActive()`: returns running entry or null
- `getAnyActive()`: returns any running entry across todos
- `getRunningCount()`: returns correct count with 0, 1, 2+ running
- `listForTodo()`: returns entries sorted by started_at desc
- `totalElapsed()`: computes sum of completed + running entries
- `totalElapsed()`: returns 0 when no entries exist
- `getCompletedWithDuration()`: returns done (non-deleted) todos with aggregated time
- `getCompletedWithDuration()`: filters by goalId and priority

### Extended: `tests/modules/todo/service.test.ts`

- Transition to in_progress creates time entry
- Transition to paused stops active time entry
- Transition to done stops active time entry
- Transition to cancelled stops active time entry
- No duplicate entry if already running on re-start
- `getByIdWithTime()` returns correct aggregated data

### New: `tests/core/date-utils.test.ts` (extend if exists, create if not)

- `formatDuration(0)` → `"0s"`
- `formatDuration(45)` → `"45s"`
- `formatDuration(312)` → `"5m 12s"`
- `formatDuration(9240)` → `"2h 34m"`
- `formatDuration(90061)` → `"25h 1m"`
- `formatDuration(-5)` → `"0s"`

### New fixture: `insertTimeEntry()` in `tests/helpers/fixtures.ts`

Accepts explicit `started_at`/`stopped_at` for deterministic tests.

## Implementation Phases

### Phase 1: Data Layer

1. `src/core/types.ts` — add `TimeEntryId`
2. `src/modules/todo/schema.ts` — migration 103
3. `src/modules/todo/drizzle-schema.ts` — `todoTimeEntries` table
4. `src/modules/todo/types.ts` — `TimeEntryRow`, `TimeEntry`, `TodoWithTime`, `timeEntryRowToEntity()`
5. `src/core/date-utils.ts` — `formatDuration()`

### Phase 2: Service Layer

6. `src/modules/todo/time-entry-service.ts` — new `TimeEntryService`
7. `src/modules/todo/service.ts` — modify `transition()`, add `getByIdWithTime()`

### Phase 3: Tests

8. `tests/helpers/fixtures.ts` — `insertTimeEntry()`
9. `tests/modules/todo/time-entry-service.test.ts` — new
10. `tests/modules/todo/service.test.ts` — extend with time integration tests
11. `tests/core/date-utils.test.ts` — `formatDuration()` tests

### Phase 4: MCP Tools

12. `src/modules/todo/tools.ts` — enhance list/get, add estimate tool

### Phase 5: CLI Commands

13. `src/modules/todo/commands.ts` — modify start/pause/done/show, add TTY detection to list

### Phase 6: Ink TUI

14. `package.json` — add ink, react deps
15. `tsconfig.json` — add jsx support, .tsx include
16. `src/modules/todo/tui/keys.ts`
17. `src/modules/todo/tui/hooks.ts`
18. `src/modules/todo/tui/status-bar.tsx`
19. `src/modules/todo/tui/todo-list.tsx`
20. `src/modules/todo/tui/app.tsx`
21. `src/modules/todo/commands.ts` — wire TUI into list command

### Phase 7: Skills

22. Delete `src/skills/weekly-standup/SKILL.md`
23. `src/skills/standup/SKILL.md` — new (replaces weekly-standup, user-defined interval)
24. `src/skills/retro/SKILL.md` — new (user-defined period)

## Verification

1. `bun run check` passes (typecheck + lint + format + test)
2. `bun run test` — all new and existing tests pass
3. Manual: `rmbr todo add "test task"` → `rmbr todo enrich 1 --title "Test" --priority high` → `rmbr todo start 1` → wait → `rmbr todo pause` → `rmbr todo start 1` → `rmbr todo done` → verify total duration displayed
4. Manual: `rmbr todo list` launches TUI in terminal; `rmbr todo list --ai` gives plain text; `rmbr todo list | cat` gives plain text
5. TUI: navigation works, Enter starts timer, Space pauses, d completes, q exits with timer running
6. MCP: `rmbr_todo_get` returns session history; `rmbr_todo_estimate` returns completed todos with durations
7. Skills: `rmbr skill list` shows standup and retro (weekly-standup removed); content references correct MCP tools
