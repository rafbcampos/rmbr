# MCP Setup

## What is MCP?

The **Model Context Protocol (MCP)** is an open standard that allows AI assistants to interact with external tools and data sources. By running rmbr as an MCP server, AI assistants like Claude can directly create, query, and manage your work entries -- todos, goals, kudos, TILs, study topics, Slack messages, and tags -- all through natural conversation.

## Starting the MCP Server

rmbr includes a built-in MCP server that runs over the **stdio transport**:

```bash
rmbr mcp
```

This starts the server and listens for MCP messages on stdin/stdout. You do not run this manually -- instead, configure your AI client to launch it automatically.

## Claude Desktop Configuration

Add the following to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "rmbr": {
      "command": "bun",
      "args": ["run", "/path/to/rmbr/bin/rmbr.ts", "mcp"]
    }
  }
}
```

Replace `/path/to/rmbr` with the absolute path to your rmbr installation.

The config file location depends on your platform:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Claude Code Configuration

For Claude Code, add the MCP server to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "rmbr": {
      "command": "bun",
      "args": ["run", "/path/to/rmbr/bin/rmbr.ts", "mcp"],
      "type": "stdio"
    }
  }
}
```

This can be placed in your project-level `.claude/settings.json` or your global settings file.

## Available MCP Tools

All rmbr modules expose their functionality as MCP tools. Each tool name is prefixed with `rmbr_`.

### Todo

| Tool                   | Description                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `rmbr_todo_create`     | Create a new todo from raw input. Accepts enrichment fields for single-step creation. |
| `rmbr_todo_list`       | List todos with optional status, pagination filters.                                  |
| `rmbr_todo_get`        | Get a single todo by ID.                                                              |
| `rmbr_todo_transition` | Transition a todo to a new status (start, pause, done, cancel).                       |
| `rmbr_todo_enrich`     | Enrich a todo with title, priority, due date, and goal link.                          |

### Goals

| Tool                              | Description                                                            |
| --------------------------------- | ---------------------------------------------------------------------- |
| `rmbr_goal_create`                | Create a new goal. Accepts enrichment fields for single-step creation. |
| `rmbr_goal_list`                  | List goals with optional status, quarter, year filters.                |
| `rmbr_goal_get`                   | Get a single goal by ID.                                               |
| `rmbr_goal_transition`            | Transition a goal to a new status (activate, complete, abandon).       |
| `rmbr_goal_enrich`                | Enrich a goal with title, quarter, year, and KPIs.                     |
| `rmbr_goal_add_star_narrative`    | Add a STAR narrative (Situation, Task, Action, Result) to a goal.      |
| `rmbr_goal_get_star_narratives`   | Retrieve all STAR narratives for a goal.                               |
| `rmbr_goal_quarterly_review_data` | Get aggregated data for a quarterly review.                            |
| `rmbr_goal_save_quarterly_review` | Save a generated quarterly review.                                     |

### Kudos

| Tool                | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `rmbr_kudos_create` | Create a kudos entry. Accepts enrichment fields for single-step creation. |
| `rmbr_kudos_list`   | List kudos with optional direction filter.                                |
| `rmbr_kudos_get`    | Get a single kudos entry by ID.                                           |
| `rmbr_kudos_enrich` | Enrich kudos with person, direction, summary, context, and goal link.     |

### TIL

| Tool               | Description                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| `rmbr_til_create`  | Create a TIL entry. Accepts enrichment fields for single-step creation. |
| `rmbr_til_list`    | List TILs with optional domain filter.                                  |
| `rmbr_til_get`     | Get a single TIL by ID.                                                 |
| `rmbr_til_search`  | Full-text search across all TIL entries.                                |
| `rmbr_til_domains` | List all known domains.                                                 |
| `rmbr_til_enrich`  | Enrich a TIL with title, content, domain, and tags.                     |

### Study

| Tool                      | Description                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| `rmbr_study_create`       | Create a study topic. Accepts enrichment fields for single-step creation. |
| `rmbr_study_list`         | List study topics with optional status and domain filters.                |
| `rmbr_study_get`          | Get a single study topic by ID.                                           |
| `rmbr_study_transition`   | Transition a study topic (start, done, park).                             |
| `rmbr_study_add_note`     | Add a note to a study topic.                                              |
| `rmbr_study_add_resource` | Add a resource URL to a study topic.                                      |
| `rmbr_study_next`         | Get the next queued study topic.                                          |
| `rmbr_study_enrich`       | Enrich a study topic with title, domain, and goal link.                   |

### Slack

| Tool                        | Description                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| `rmbr_slack_ingest`         | Ingest a Slack message with optional channel, sender, and timestamp.   |
| `rmbr_slack_list`           | List messages with optional channel, processed, and sentiment filters. |
| `rmbr_slack_get`            | Get a single Slack message by ID.                                      |
| `rmbr_slack_set_sentiment`  | Set sentiment on a message (positive, negative, neutral).              |
| `rmbr_slack_link_todo`      | Link a Slack message to a todo.                                        |
| `rmbr_slack_link_goal`      | Link a Slack message to a goal.                                        |
| `rmbr_slack_mark_processed` | Mark a Slack message as processed.                                     |

### Tags

| Tool                    | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `rmbr_tag_entity`       | Add a tag to any entity (todo, kudos, goal, til, study, slack). |
| `rmbr_untag_entity`     | Remove a tag from an entity.                                    |
| `rmbr_tag_list`         | List all tags.                                                  |
| `rmbr_tag_get_entities` | Get all entities with a given tag, optionally filtered by type. |
| `rmbr_entity_tags`      | Get all tags for a specific entity.                             |

## Single-Step Creation

All `create` tools accept enrichment fields directly alongside the raw input. This means an AI assistant can create a fully enriched entity in a single tool call rather than requiring separate create and enrich steps.

For example, `rmbr_todo_create` accepts not only the raw input text but also `title`, `priority`, `due_date`, and `goal_id` -- all in one call. This reduces round trips and makes AI interactions faster and more natural.

## Example Interaction

Here is how a conversation with an AI assistant using rmbr might look:

> **You:** I just fixed the login bug that was causing session timeouts.

The AI assistant recognizes this as a completed task and uses rmbr tools behind the scenes:

1. **Creates a todo** via `rmbr_todo_create` with the raw input and enrichment fields:

   ```json
   {
     "raw_input": "Fixed the login bug causing session timeouts",
     "title": "Fix login session timeout bug",
     "priority": "high"
   }
   ```

2. **Transitions it to done** via `rmbr_todo_transition`:

   ```json
   {
     "id": 1,
     "status": "done"
   }
   ```

3. **Creates a TIL** via `rmbr_til_create` to capture the learning:
   ```json
   {
     "raw_input": "Session timeouts were caused by login flow not refreshing tokens",
     "title": "Login session timeout root cause",
     "domain": "authentication"
   }
   ```

> **AI:** Done. I have recorded that as a completed todo and captured a TIL about the session timeout root cause. Would you like to link it to a goal?

This seamless interaction is possible because the AI assistant has direct access to all rmbr tools through MCP.
