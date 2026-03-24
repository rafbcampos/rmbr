# Todos

Todos are actionable tasks with built-in time tracking. They go through a lifecycle from sketch to completion, with automatic timer management on status transitions.

## Entity Fields

| Field             | Type               | Description                         |
| ----------------- | ------------------ | ----------------------------------- |
| id                | `TodoId`           | Branded numeric ID                  |
| raw_input         | `string`           | Original input text                 |
| title             | `string \| null`   | Enriched title (starts with a verb) |
| status            | `TodoStatus`       | Current status                      |
| priority          | `string \| null`   | `low`, `medium`, `high`, `critical` |
| due_date          | `string \| null`   | ISO date (`YYYY-MM-DD`)             |
| goal_id           | `number \| null`   | Linked goal                         |
| enrichment_status | `EnrichmentStatus` | `raw` or `enriched`                 |
| created_at        | `string`           | ISO timestamp                       |
| updated_at        | `string`           | ISO timestamp                       |

## Time Tracking

Todos have session-based time tracking stored in the `todo_time_entries` table. Each time entry records a work session with `started_at` and `stopped_at` timestamps.

**How it works:**

- Transitioning to `in_progress` starts a timer (creates a time entry)
- Transitioning to `paused`, `done`, or `cancelled` stops the active timer
- Closing the terminal leaves the timer running (it's a DB timestamp, not a process)
- Total elapsed time is computed as the sum of all sessions
- Multiple todos can have running timers simultaneously

**Interactive TUI:** `rmbr todo list` opens an Ink-based interactive terminal UI with:

- Arrow keys to navigate, `Enter` to start, `Space` to pause/resume, `d` for done, `q` to exit
- Status filtering (keys `1-5`) and priority cycling (key `p`)
- Live elapsed time counter for the active task
- Use `--ai` flag for plain text output (for AI agents or scripts)

## Status Transitions

```
sketch --> ready --> in_progress --> done
                       |       \-> cancelled
                       v
                     paused --> in_progress
                       \------> cancelled
```

| From          | To                            |
| ------------- | ----------------------------- |
| `sketch`      | `ready`, `cancelled`          |
| `ready`       | `in_progress`, `cancelled`    |
| `in_progress` | `paused`, `done`, `cancelled` |
| `paused`      | `in_progress`, `cancelled`    |

`done` and `cancelled` are terminal statuses.

## CLI Commands

| Command             | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `rmbr todo add`     | Create a new todo from raw input                                                         |
| `rmbr todo list`    | Interactive TUI (default) or plain text (`--ai`, `--status`, `--overdue`, `--due-today`) |
| `rmbr todo show`    | Show a todo with time tracking sessions and total elapsed time                           |
| `rmbr todo start`   | Start working (transitions to `in_progress`, starts timer)                               |
| `rmbr todo pause`   | Pause (auto-detects active timer if no id given)                                         |
| `rmbr todo done`    | Mark as done (shows total time spent; auto-detects active timer)                         |
| `rmbr todo cancel`  | Cancel a todo                                                                            |
| `rmbr todo delete`  | Soft-delete a todo                                                                       |
| `rmbr todo restore` | Restore a soft-deleted todo                                                              |
| `rmbr todo enrich`  | Enrich a todo with structured fields                                                     |

## MCP Tools

| Tool                   | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `rmbr_todo_create`     | Create a new todo; accepts optional enrichment fields                    |
| `rmbr_todo_list`       | List todos with filters; includes `total_elapsed_seconds` per todo       |
| `rmbr_todo_get`        | Get a todo with session history and total elapsed time                   |
| `rmbr_todo_transition` | Transition a todo (auto-manages timers on start/pause/done/cancel)       |
| `rmbr_todo_estimate`   | Returns completed todos with actual duration for LLM-assisted estimation |
| `rmbr_todo_delete`     | Soft-delete a todo                                                       |
| `rmbr_todo_restore`    | Restore a soft-deleted todo                                              |
| `rmbr_todo_enrich`     | Enrich a raw todo with title, priority, due date, goal                   |
