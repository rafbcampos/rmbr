# rmbr

CLI second brain for work — capture todos, goals, kudos, learnings, study topics, and Slack messages from your terminal or AI assistant.

## Features

- **7 purpose-built modules** — todos, goals, kudos, TILs, study topics, Slack messages, and cross-entity tags
- **Entity enrichment** — transform raw input into structured data with AI assistance in a single step
- **MCP server** — expose every module as tools for AI assistants like Claude Desktop
- **Cross-entity tags** — label and filter any entity type with a shared tagging system
- **Soft-delete** — delete and restore any entity; deleted entities are hidden from lists by default
- **Cross-module search** — search across todos, goals, kudos, TILs, study topics, and slack messages in one query
- **Reverse relationship queries** — view all entities linked to a goal (todos, kudos, study topics, slack messages)
- **Due date filtering** — filter todos by overdue, due today, or due this week
- **STAR narratives** — attach Situation/Task/Action/Result stories to goals for performance reviews
- **Quarterly reviews** — generate goal summaries scoped to any quarter
- **Full-text search** — search TIL entries by content
- **Time tracking** — automatic session-based time tracking for todos with start/pause/done lifecycle
- **Interactive TUI** — every module has an Ink-based interactive terminal UI with master-detail layout, preview pane, inline field editing, status dots, and keyboard navigation
- **Dual-mode CLI** — interactive TUI for humans (default), plain text with `--ai` flag for AI agents; auto-detects non-TTY output
- **LLM-assisted estimation** — expose historical time data via MCP for AI-powered task estimation
- **AI workflow skills** — bundled slash commands for Claude Code: standup, retro, quarterly review, goal planning, Slack triage, study sessions, and performance reviews
- **Skills CLI** — `rmbr skill install` to add all skills to Claude Code as `/rmbr-*` slash commands
- **Local SQLite storage** — all data lives in `~/.rmbr/rmbr.db`

## Quick Start

rmbr is a private project — clone and install locally:

```sh
git clone <repo-url> && cd rmbr
bun install
```

`bun install` automatically registers the `rmbr` command on your PATH via `bun link`, so you can use it from anywhere:

### CLI

```sh
rmbr todo add "Fix the login bug"
rmbr goal add "Ship the new onboarding flow"
rmbr kudos add "Alice helped debug the auth issue"
rmbr til add "You can use branded types in TypeScript for type-safe IDs"
rmbr study add "Distributed consensus algorithms"
rmbr tag add "work" todo 1
```

### MCP Server

Start the MCP server for use with AI assistants:

```sh
rmbr mcp
```

Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rmbr": {
      "command": "rmbr",
      "args": ["mcp"]
    }
  }
}
```

## Modules

| Module    | Description                          | Statuses                                                        |
| --------- | ------------------------------------ | --------------------------------------------------------------- |
| **todo**  | Task tracking                        | `sketch`, `ready`, `in_progress`, `paused`, `done`, `cancelled` |
| **goals** | Quarterly goals with STAR narratives | `draft`, `active`, `completed`, `abandoned`                     |
| **kudos** | Recognition tracking                 | `given`, `received` (direction)                                 |
| **til**   | Today I Learned entries              | enrichment only, no status                                      |
| **study** | Study topic tracking                 | `queued`, `in_progress`, `completed`, `parked`                  |
| **slack** | Slack message capture                | `positive`, `negative`, `neutral` (sentiment)                   |
| **tags**  | Cross-entity labeling                | N/A                                                             |

## CLI Commands

All `list` commands open an interactive TUI by default. Use `--ai` for plain text output suitable for scripts and AI agents. Filters (e.g. `--status`, `--domain`) also produce plain text output.

### todo

```
todo add <input>           Create a new todo from raw input
todo list                  Interactive TUI (default) or plain text (--ai, --status, --overdue, --due-today, --due-this-week)
todo show <id>             Show a todo with time tracking sessions and total elapsed time
todo start <id>            Start working (transitions to in_progress, starts timer)
todo pause [id]            Pause (auto-detects active timer if no id given)
todo done [id]             Mark as done (shows total time spent)
todo cancel <id>           Cancel a todo
todo delete <id>           Soft-delete a todo
todo restore <id>          Restore a soft-deleted todo
todo enrich <id>           Enrich with structured data (--title, --priority, --due-date, --goal-id)
```

**TUI keys:** `↑↓` navigate, `⏎` start, `␣` pause/resume, `d` done, `e` edit, `p` priority, `1-5` status, `q` quit

### goal

```
goal add <input>           Create a new goal
goal list                  Interactive TUI (default) or plain text (--ai, -s status, -q quarter, -y year)
goal show <id>             Show a single goal
goal activate <id>         Transition to active
goal complete <id>         Transition to completed
goal abandon <id>          Transition to abandoned
goal delete <id>           Soft-delete a goal
goal restore <id>          Restore a soft-deleted goal
goal related <id>          Show all entities linked to a goal (todos, kudos, study topics, slack messages)
goal enrich <id>           Enrich with details (-t title, -q quarter, -y year, -k kpis)
goal star <id>             Add a STAR narrative (--situation, --task, --action, --result)
goal review                Get quarterly review data (-q quarter, -y year)
```

**TUI keys:** `↑↓` navigate, `⏎` activate, `d` complete, `a` abandon, `e` edit, `r` quarter, `1-5` status, `q` quit

### kudos

```
kudos add <input>          Record a kudos entry from raw input
kudos list                 Interactive TUI (default) or plain text (--ai, --direction, --include-deleted)
kudos show <id>            Show a single kudos
kudos delete <id>          Soft-delete a kudos entry
kudos restore <id>         Restore a soft-deleted kudos entry
kudos enrich <id>          Enrich with structured data (--person, --direction, --summary, --context, --goal-id)
```

**TUI keys:** `↑↓` navigate, `e` edit, `1-3` direction filter, `q` quit

### til

```
til add <input>            Record a TIL entry
til list                   Interactive TUI (default) or plain text (--ai, --domain, --include-deleted)
til show <id>              Show a single TIL
til search <query>         Full-text search across TILs
til domains                List all TIL domains
til delete <id>            Soft-delete a TIL entry
til restore <id>           Restore a soft-deleted TIL entry
til enrich <id>            Enrich with structured data (--title, --content, --domain, --tags)
```

**TUI keys:** `↑↓` navigate, `e` edit, `d` cycle domain, `q` quit

### study

```
study add <input>          Add a study topic
study list                 Interactive TUI (default) or plain text (--ai, --status, --domain, --include-deleted)
study show <id>            Show a single study topic
study start <id>           Transition to in_progress
study done <id>            Mark as completed
study park <id>            Park a topic
study delete <id>          Soft-delete a study topic
study restore <id>         Restore a soft-deleted study topic
study note <id> <note>     Add a note
study resource <id> <url>  Add a resource URL
study next                 Show the next queued topic
study enrich <id>          Enrich with structured data (--title, --domain, --goal-id)
```

**TUI keys:** `↑↓` navigate, `⏎` start, `c` complete, `p` park, `e` edit, `d` domain, `1-5` status, `q` quit

### slack

```
slack ingest <content>     Capture a Slack message (--channel, --sender, --message-ts)
slack list                 Interactive TUI (default) or plain text (--ai, --channel, --processed, --sentiment)
slack sentiment <id> <s>   Set sentiment (positive, negative, neutral)
slack link-todo <id> <tid> Link a message to a todo
slack link-goal <id> <gid> Link a message to a goal
slack process <id>         Mark a message as processed
slack delete <id>          Soft-delete a slack message
slack restore <id>         Restore a soft-deleted slack message
```

**TUI keys:** `↑↓` navigate, `⏎` process, `e` edit, `s` sentiment, `1-3` filter, `q` quit

### tag

```
tag add <tag> <type> <id>        Tag an entity (types: todo, kudos, goal, til, study, slack)
tag remove <tag> <type> <id>     Remove a tag from an entity
tag list                         Interactive TUI (default) or plain text (--ai)
tag entities <tag>               Get entities with a tag (--type)
tag show <entity_type> <id>      Show tags for an entity
```

**TUI keys:** `↑↓` navigate, `⏎` select, `Esc` back, `t` cycle type, `q` quit

### search

```
search <query>             Search across all modules (todos, goals, kudos, TILs, study topics, slack messages)
```

### skill

```
skill list                 List all bundled skills
skill show <name>          Show a skill's content
skill install [name]       Install skills to ~/.claude/commands/ (--local for project)
skill uninstall            Remove rmbr skills from Claude Code (--local for project)
```

## Skills

rmbr bundles AI workflow skills — guided multi-step workflows for Claude Code. Install them with:

```sh
rmbr skill install
```

This creates `/rmbr-*` slash commands in Claude Code:

| Skill                | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `standup`            | Generate a standup with time tracking data (any period)    |
| `retro`              | Retrospective report with time analysis (any period)       |
| `quarterly-review`   | Generate a quarterly goal review with STAR narratives      |
| `goal-plan`          | Conversational goal planning with KPI suggestions          |
| `slack-process`      | Triage Slack messages: sentiment, todos, kudos, goal links |
| `slack-ingest`       | Fetch messages from Slack MCP and ingest into rmbr         |
| `slack-setup`        | One-time guide for configuring the Slack MCP server        |
| `study-session`      | Interactive study session with notes and TIL capture       |
| `performance-review` | Generate a self-review narrative from goals and kudos      |

## MCP Tools

When running in MCP mode (`rmbr mcp`), every module exposes its operations as MCP tools. AI assistants can create, list, update, enrich, and transition entities through the standard Model Context Protocol. Create tools accept enrichment fields directly, enabling single-step fully enriched entity creation.

Additional cross-cutting MCP tools:

- `rmbr_search` — search across all modules in one query
- `rmbr_goal_related` — get all entities linked to a goal
- `rmbr_<module>_delete` / `rmbr_<module>_restore` — soft-delete and restore entities
- `rmbr_todo_list` accepts `overdue`, `due_today`, `due_this_week` boolean params for due date filtering; includes `total_elapsed_seconds` per todo
- `rmbr_todo_get` — includes time entry sessions and total elapsed time
- `rmbr_todo_estimate` — returns completed todos with actual duration for LLM-assisted estimation

## Development

```sh
git clone <repo-url> && cd rmbr
bun install
bun run check        # full quality gate: typecheck + lint + format + test
bun run test         # run tests
bun run typecheck    # tsc --noEmit
bun run lint         # oxlint
bun run format       # prettier --check
bun run format:fix   # prettier --write
```

## Documentation

Full documentation is available on the [VitePress docs site](https://rafbcampos.github.io/rmbr/).

## License

MIT
