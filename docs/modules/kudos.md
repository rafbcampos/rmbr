# Kudos

Track recognition given and received. Link kudos to goals for performance review evidence, building a record of collaboration and impact.

## Entity Fields

| Field             | Type                     | Description                  |
| ----------------- | ------------------------ | ---------------------------- |
| id                | `KudosId`                | Branded numeric ID           |
| raw_input         | `string`                 | Original input text          |
| direction         | `KudosDirection \| null` | `given` or `received`        |
| person            | `string \| null`         | Person name                  |
| summary           | `string \| null`         | One-sentence summary         |
| context           | `string \| null`         | Situation or project context |
| goal_id           | `number \| null`         | Linked goal                  |
| enrichment_status | `EnrichmentStatus`       | `raw` or `enriched`          |
| created_at        | `string`                 | ISO timestamp                |
| updated_at        | `string`                 | ISO timestamp                |

## CLI Commands

For full syntax details, see the [CLI Reference](/guide/cli-usage).

| Command              | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `rmbr kudos add`     | Record a new kudos from raw input                                |
| `rmbr kudos list`    | List kudos, optionally filter by direction (`--include-deleted`) |
| `rmbr kudos show`    | Show a single kudos entry by ID                                  |
| `rmbr kudos delete`  | Soft-delete a kudos entry (hidden from lists by default)         |
| `rmbr kudos restore` | Restore a soft-deleted kudos entry                               |
| `rmbr kudos enrich`  | Enrich a kudos with direction, person, summary, context          |

## MCP Tools

| Tool                 | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `rmbr_kudos_create`  | Create a new kudos; accepts optional enrichment fields      |
| `rmbr_kudos_list`    | List kudos with optional direction and enrichment filters   |
| `rmbr_kudos_get`     | Get a single kudos entry by ID                              |
| `rmbr_kudos_delete`  | Soft-delete a kudos entry                                   |
| `rmbr_kudos_restore` | Restore a soft-deleted kudos entry                          |
| `rmbr_kudos_enrich`  | Enrich a raw kudos with direction, person, summary, context |
