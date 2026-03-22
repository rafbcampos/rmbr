# rmbr

CLI second brain for work — capture todos, goals, kudos, learnings, study topics, and Slack messages from your terminal or AI assistant.

## Features

- **7 purpose-built modules** — todos, goals, kudos, TILs, study topics, Slack messages, and cross-entity tags
- **Entity enrichment** — transform raw input into structured data with AI assistance in a single step
- **MCP server** — expose every module as tools for AI assistants like Claude Desktop
- **Cross-entity tags** — label and filter any entity type with a shared tagging system
- **STAR narratives** — attach Situation/Task/Action/Result stories to goals for performance reviews
- **Quarterly reviews** — generate goal summaries scoped to any quarter
- **Full-text search** — search TIL entries by content
- **Local SQLite storage** — all data lives in `~/.rmbr/rmbr.db`

## Quick Start

rmbr is a private project — clone and install locally:

```sh
git clone <repo-url> && cd rmbr
bun install
```

### CLI

```sh
bun run rmbr todo add "Fix the login bug"
bun run rmbr goal add "Ship the new onboarding flow"
bun run rmbr kudos add "Alice helped debug the auth issue"
bun run rmbr til add "You can use branded types in TypeScript for type-safe IDs"
bun run rmbr study add "Distributed consensus algorithms"
bun run rmbr tag add "work" todo 1
```

### MCP Server

Start the MCP server for use with AI assistants:

```sh
bun run rmbr mcp
```

Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rmbr": {
      "command": "bun",
      "args": ["run", "rmbr", "mcp"]
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

### todo

```
todo add <input>           Create a new todo from raw input
todo list                  List todos (--status, --page, --page-size)
todo show <id>             Show a single todo
todo start <id>            Transition to in_progress
todo pause <id>            Transition to paused
todo done <id>             Mark as done
todo cancel <id>           Cancel a todo
todo enrich <id>           Enrich with structured data (--title, --priority, --due-date, --goal-id)
```

### goal

```
goal add <input>           Create a new goal
goal list                  List goals (-s status, -q quarter, -y year, -p page, --page-size)
goal show <id>             Show a single goal
goal activate <id>         Transition to active
goal complete <id>         Transition to completed
goal abandon <id>          Transition to abandoned
goal enrich <id>           Enrich with details (-t title, -q quarter, -y year, -k kpis)
goal star <id>             Add a STAR narrative (--situation, --task, --action, --result)
goal review                Get quarterly review data (-q quarter, -y year)
```

### kudos

```
kudos add <input>          Record a kudos entry from raw input
kudos list                 List kudos (--direction, --page)
kudos show <id>            Show a single kudos
kudos enrich <id>          Enrich with structured data (--person, --direction, --summary, --context, --goal-id)
```

### til

```
til add <input>            Record a TIL entry
til list                   List TILs (--domain, --page)
til show <id>              Show a single TIL
til search <query>         Full-text search across TILs
til domains                List all TIL domains
til enrich <id>            Enrich with structured data (--title, --content, --domain, --tags)
```

### study

```
study add <input>          Add a study topic
study list                 List study topics (--status, --domain, --page, --page-size)
study show <id>            Show a single study topic
study start <id>           Transition to in_progress
study done <id>            Mark as completed
study park <id>            Park a topic
study note <id> <note>     Add a note
study resource <id> <url>  Add a resource URL
study next                 Show the next queued topic
study enrich <id>          Enrich with structured data (--title, --domain, --goal-id)
```

### slack

```
slack ingest <content>     Capture a Slack message (--channel, --sender, --message-ts)
slack list                 List captured messages (--channel, --processed, --sentiment, --page)
slack sentiment <id> <s>   Set sentiment (positive, negative, neutral)
slack link-todo <id> <tid> Link a message to a todo
slack link-goal <id> <gid> Link a message to a goal
slack process <id>         Mark a message as processed
```

### tag

```
tag add <tag> <type> <id>        Tag an entity (types: todo, kudos, goal, til, study, slack)
tag remove <tag> <type> <id>     Remove a tag from an entity
tag list                         List all tags
tag entities <tag>               Get entities with a tag (--type)
tag show <entity_type> <id>      Show tags for an entity
```

## MCP Tools

When running in MCP mode (`bun run rmbr mcp`), every module exposes its operations as MCP tools. AI assistants can create, list, update, enrich, and transition entities through the standard Model Context Protocol. Create tools accept enrichment fields directly, enabling single-step fully enriched entity creation.

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
