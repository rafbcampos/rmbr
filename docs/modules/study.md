# Study

Track study topics with notes, resources, and a learning queue.

## Entity Fields

| Field             | Type               | Description                     |
| ----------------- | ------------------ | ------------------------------- |
| id                | `StudyTopicId`     | Branded numeric ID              |
| raw_input         | `string`           | Original input text             |
| title             | `string \| null`   | Clear topic title               |
| status            | `StudyStatus`      | Current status                  |
| domain            | `string \| null`   | Lowercase domain classification |
| notes             | `string`           | JSON array of note strings      |
| resources         | `string`           | JSON array of resource URLs     |
| goal_id           | `number \| null`   | Linked goal                     |
| enrichment_status | `EnrichmentStatus` | `raw` or `enriched`             |
| created_at        | `string`           | ISO timestamp                   |
| updated_at        | `string`           | ISO timestamp                   |

## Status Transitions

Study topics follow a lifecycle from queue to completion:

```
queued --> in_progress --> completed
              |       \-> parked --> in_progress
              v
           completed
```

| From          | To                    |
| ------------- | --------------------- |
| `queued`      | `in_progress`         |
| `in_progress` | `completed`, `parked` |
| `parked`      | `in_progress`         |

`completed` is a terminal status.

## Notes & Resources

Accumulate notes and resource URLs over time. Each add appends to the respective JSON array, so the full history is preserved.

## Study Queue

`rmbr study next` returns the oldest queued topic — a simple FIFO queue for deciding what to study next.

## Interactive TUI

`rmbr study list` opens an interactive terminal UI:

- Arrow keys to navigate, `q` to quit
- Status filter: `1` all, `2` queued, `3` in_progress, `4` completed, `5` parked
- Domain cycle: `d` to cycle through available domains
- Actions: `Enter` start (queued/parked), `c` complete (in_progress), `p` park (in_progress)
- Color-coded statuses: queued (blue), in_progress (green), completed (cyan), parked (yellow)
- Shows next queued topic hint in the status bar
- Use `--ai` for plain text output (for AI agents or scripts)

## CLI Commands

For full syntax details, see the [CLI Reference](/guide/cli-usage).

| Command               | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `rmbr study add`      | Create a new study topic from raw input                                  |
| `rmbr study list`     | Interactive TUI (default) or plain text (`--ai`, `--status`, `--domain`) |
| `rmbr study show`     | Show a single topic by ID                                                |
| `rmbr study start`    | Transition a topic to `in_progress`                                      |
| `rmbr study done`     | Mark a topic as `completed`                                              |
| `rmbr study park`     | Park an in-progress topic                                                |
| `rmbr study delete`   | Soft-delete a study topic (hidden from lists by default)                 |
| `rmbr study restore`  | Restore a soft-deleted study topic                                       |
| `rmbr study note`     | Append a note to a topic                                                 |
| `rmbr study resource` | Append a resource URL to a topic                                         |
| `rmbr study next`     | Show the next queued topic (FIFO)                                        |
| `rmbr study enrich`   | Enrich a topic with structured fields                                    |

## MCP Tools

| Tool                      | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `rmbr_study_create`       | Create a new topic; accepts optional enrichment fields  |
| `rmbr_study_list`         | List topics with optional status and enrichment filters |
| `rmbr_study_get`          | Get a single topic by ID                                |
| `rmbr_study_transition`   | Transition a topic to a new status                      |
| `rmbr_study_delete`       | Soft-delete a study topic                               |
| `rmbr_study_restore`      | Restore a soft-deleted study topic                      |
| `rmbr_study_add_note`     | Append a note to a topic                                |
| `rmbr_study_add_resource` | Append a resource URL to a topic                        |
| `rmbr_study_next`         | Get the next queued topic (FIFO)                        |
| `rmbr_study_enrich`       | Enrich a raw topic with title, domain, and goal         |
