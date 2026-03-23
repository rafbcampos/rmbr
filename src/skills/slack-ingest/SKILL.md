---
name: slack-ingest
description: 'Fetch Slack messages (mentions, DMs, channels) via the Slack MCP and ingest them into rmbr for triage. Trigger: ingest slack, fetch slack, pull slack messages, sync slack.'
---

# Slack Message Ingestion

Fetch messages from Slack using the Slack MCP server and ingest them into rmbr for processing.

**Prerequisite:** The user must have the Slack MCP server configured alongside rmbr. Run `/rmbr-slack-setup` if not configured.

## Workflow

1. **Fetch @mentions**: Call `conversations_unreads` (Slack MCP) with `mentions_only: true` to get channels where the user was mentioned. For each channel with mentions, call `conversations_history` to retrieve the messages.

2. **Fetch recent DMs**: Call `channels_list` (Slack MCP) with `channel_types: "im"` to list DM conversations. For the most active ones, call `conversations_history` with a recent time range (e.g., `limit: "1d"` or `limit: "7d"` depending on user preference).

3. **Optionally fetch specific channels**: Ask the user if they want to ingest messages from specific channels. If yes, call `conversations_history` (Slack MCP) with the channel name or ID.

4. **Deduplicate**: Before ingesting, call `rmbr_slack_list` to check for existing messages with matching `message_ts` and `channel` to avoid duplicates.

5. **Ingest each message**: For each new message, call `rmbr_slack_ingest` with:
   - `raw_content`: The message text
   - `channel`: Channel name or DM identifier
   - `sender`: Message author
   - `message_ts`: Slack message timestamp

6. **Trigger processing**: After ingestion, suggest running `/rmbr-slack-process` to triage the newly ingested messages (sentiment analysis, todo extraction, goal linking).

7. **Summary**: Report how many messages were ingested, broken down by source (mentions, DMs, channels).

## MCP Tools Used

### Slack MCP (korotovsky/slack-mcp-server)

- `conversations_unreads` — Find channels with unread mentions
- `conversations_history` — Fetch messages from a channel or DM
- `channels_list` — List channels by type (public, private, DM)

### rmbr MCP

- `rmbr_slack_list` — Check for existing messages (deduplication)
- `rmbr_slack_ingest` — Create new Slack message entries
