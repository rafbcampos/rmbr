# Todos

Todos are actionable tasks. They go through a lifecycle from sketch to completion, with enrichment adding structure to raw input.

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

## Status Transitions

Todos follow a defined lifecycle through these statuses:

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

For full syntax details, see the [CLI Reference](/guide/cli-usage).

| Command             | Description                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `rmbr todo add`     | Create a new todo from raw input                                                                             |
| `rmbr todo list`    | List todos, optionally filter by status (`--include-deleted`, `--overdue`, `--due-today`, `--due-this-week`) |
| `rmbr todo show`    | Show a single todo by ID                                                                                     |
| `rmbr todo start`   | Transition a todo to `in_progress`                                                                           |
| `rmbr todo pause`   | Pause an in-progress todo                                                                                    |
| `rmbr todo done`    | Mark a todo as done                                                                                          |
| `rmbr todo cancel`  | Cancel a todo                                                                                                |
| `rmbr todo delete`  | Soft-delete a todo (hidden from lists by default)                                                            |
| `rmbr todo restore` | Restore a soft-deleted todo                                                                                  |
| `rmbr todo enrich`  | Enrich a todo with structured fields                                                                         |

## MCP Tools

| Tool                   | Description                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `rmbr_todo_create`     | Create a new todo; accepts optional enrichment fields                                                       |
| `rmbr_todo_list`       | List todos with optional status, enrichment, and due date filters (`overdue`, `due_today`, `due_this_week`) |
| `rmbr_todo_get`        | Get a single todo by ID                                                                                     |
| `rmbr_todo_transition` | Transition a todo to a new status                                                                           |
| `rmbr_todo_delete`     | Soft-delete a todo                                                                                          |
| `rmbr_todo_restore`    | Restore a soft-deleted todo                                                                                 |
| `rmbr_todo_enrich`     | Enrich a raw todo with title, priority, due date, goal                                                      |
