# Slack

Capture and process Slack messages. Link them to todos and goals, classify sentiment.

## Entity Fields

| Field             | Type                     | Description                        |
| ----------------- | ------------------------ | ---------------------------------- |
| id                | `SlackMessageId`         | Branded numeric ID                 |
| raw_content       | `string`                 | Raw message content                |
| channel           | `string \| null`         | Slack channel name                 |
| sender            | `string \| null`         | Message sender                     |
| message_ts        | `string \| null`         | Slack message timestamp            |
| sentiment         | `SlackSentiment \| null` | `positive`, `negative`, `neutral`  |
| processed         | `number`                 | `0` = unprocessed, `1` = processed |
| todo_id           | `number \| null`         | Linked todo                        |
| goal_id           | `number \| null`         | Linked goal                        |
| enrichment_status | `EnrichmentStatus`       | `raw` or `enriched`                |
| created_at        | `string`                 | ISO timestamp                      |
| updated_at        | `string`                 | ISO timestamp                      |

## Workflow

Slack messages follow a processing workflow rather than a status lifecycle:

1. **Ingest** messages via `rmbr slack ingest` or `rmbr_slack_ingest`
2. **Set sentiment** — classify as `positive`, `negative`, or `neutral`
3. **Link** to existing todos or goals for cross-referencing
4. **Mark as processed** when the message has been fully handled

## Interactive TUI

`rmbr slack list` opens an interactive terminal UI:

- Arrow keys to navigate, `q` to quit
- Processed filter: `1` all, `2` unprocessed, `3` processed
- Sentiment cycle: `s` to cycle through positive/negative/neutral
- Actions: `Enter` mark as processed (if unprocessed)
- Sentiment colors: positive (green), negative (red), neutral (gray)
- Shows channel, sender, content snippet, and linked entities (T#N, G#N)
- Use `--ai` for plain text output (for AI agents or scripts)

## CLI Commands

For full syntax details, see the [CLI Reference](/guide/cli-usage).

| Command                | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `rmbr slack ingest`    | Ingest a Slack message from raw content                                      |
| `rmbr slack list`      | Interactive TUI (default) or plain text (`--ai`, `--channel`, `--sentiment`) |
| `rmbr slack sentiment` | Set sentiment on a message                                                   |
| `rmbr slack link-todo` | Link a message to an existing todo                                           |
| `rmbr slack link-goal` | Link a message to an existing goal                                           |
| `rmbr slack process`   | Mark a message as processed                                                  |
| `rmbr slack delete`    | Soft-delete a slack message (hidden from lists by default)                   |
| `rmbr slack restore`   | Restore a soft-deleted slack message                                         |

## MCP Tools

| Tool                        | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `rmbr_slack_ingest`         | Ingest a Slack message; accepts optional metadata |
| `rmbr_slack_list`           | List messages with optional processing filters    |
| `rmbr_slack_get`            | Get a single message by ID                        |
| `rmbr_slack_set_sentiment`  | Set sentiment on a message                        |
| `rmbr_slack_link_todo`      | Link a message to an existing todo                |
| `rmbr_slack_link_goal`      | Link a message to an existing goal                |
| `rmbr_slack_mark_processed` | Mark a message as processed                       |
| `rmbr_slack_delete`         | Soft-delete a slack message                       |
| `rmbr_slack_restore`        | Restore a soft-deleted slack message              |
