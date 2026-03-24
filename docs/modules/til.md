# TIL (Today I Learned)

Capture daily learnings with domain classification and full-text search.

## Entity Fields

| Field             | Type               | Description                                     |
| ----------------- | ------------------ | ----------------------------------------------- |
| id                | `TilId`            | Branded numeric ID                              |
| raw_input         | `string`           | Original input text                             |
| title             | `string \| null`   | Concise descriptive title                       |
| content           | `string \| null`   | Structured explanation                          |
| domain            | `string \| null`   | Lowercase domain tag (e.g., typescript, devops) |
| tags              | `string`           | JSON array of keyword tags                      |
| enrichment_status | `EnrichmentStatus` | `raw` or `enriched`                             |
| created_at        | `string`           | ISO timestamp                                   |
| updated_at        | `string`           | ISO timestamp                                   |

## Enrichment

TILs have no status lifecycle. Enrichment adds a title, structured content, domain classification, and keyword tags to the raw input.

## Full-Text Search

TIL supports full-text search via `rmbr til search <query>` and the `rmbr_til_search` MCP tool. Queries match against title, content, and raw input.

## Domains

Each TIL can be classified into a domain (e.g., `typescript`, `devops`, `sql`). List all unique domains with `rmbr til domains` or the `rmbr_til_domains` MCP tool.

## Interactive TUI

`rmbr til list` opens an interactive terminal UI:

- Arrow keys to navigate, `q` to quit
- Domain cycle: `d` to cycle through available domains
- Shows domain in cyan, tag count, and creation date per entry
- Use `--ai` for plain text output (for AI agents or scripts)

## CLI Commands

For full syntax details, see the [CLI Reference](/guide/cli-usage).

| Command            | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| `rmbr til add`     | Create a new TIL from raw input                              |
| `rmbr til list`    | Interactive TUI (default) or plain text (`--ai`, `--domain`) |
| `rmbr til show`    | Show a single TIL by ID                                      |
| `rmbr til search`  | Full-text search across TILs                                 |
| `rmbr til domains` | List all unique domains                                      |
| `rmbr til delete`  | Soft-delete a TIL entry (hidden from lists by default)       |
| `rmbr til restore` | Restore a soft-deleted TIL entry                             |
| `rmbr til enrich`  | Enrich a TIL with structured fields                          |

## MCP Tools

| Tool               | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `rmbr_til_create`  | Create a new TIL; accepts optional enrichment fields   |
| `rmbr_til_list`    | List TILs with optional domain and enrichment filters  |
| `rmbr_til_get`     | Get a single TIL by ID                                 |
| `rmbr_til_search`  | Full-text search across TILs                           |
| `rmbr_til_domains` | List all unique domains                                |
| `rmbr_til_delete`  | Soft-delete a TIL entry                                |
| `rmbr_til_restore` | Restore a soft-deleted TIL entry                       |
| `rmbr_til_enrich`  | Enrich a raw TIL with title, content, domain, and tags |
