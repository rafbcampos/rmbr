# Goals

Goals are quarterly objectives that support STAR narratives and quarterly reviews. They connect day-to-day work to measurable outcomes for performance reviews.

## Entity Fields

| Field             | Type               | Description                 |
| ----------------- | ------------------ | --------------------------- |
| id                | `GoalId`           | Branded numeric ID          |
| raw_input         | `string`           | Original input text         |
| title             | `string \| null`   | Enriched title (5-10 words) |
| status            | `GoalStatus`       | Current status              |
| quarter           | `Quarter \| null`  | `Q1`, `Q2`, `Q3`, `Q4`      |
| year              | `number \| null`   | Calendar year               |
| kpis              | `string`           | JSON array of KPI strings   |
| enrichment_status | `EnrichmentStatus` | `raw` or `enriched`         |
| created_at        | `string`           | ISO timestamp               |
| updated_at        | `string`           | ISO timestamp               |

## Status Transitions

```
draft --> active --> completed
                \--> abandoned
```

| From     | To                       |
| -------- | ------------------------ |
| `draft`  | `active`                 |
| `active` | `completed`, `abandoned` |

`completed` and `abandoned` are terminal statuses.

## STAR Narratives

Goals support Situation-Task-Action-Result narratives for building performance review evidence over time.

| Field     | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| id        | `number` | Narrative ID                   |
| goal_id   | `number` | Linked goal                    |
| situation | `string` | Context and background         |
| task      | `string` | What needed to be accomplished |
| action    | `string` | Steps taken                    |
| result    | `string` | Outcome and impact             |

## Quarterly Reviews

Aggregate goal data into a quarterly summary for review conversations.

| Field               | Type      | Description                   |
| ------------------- | --------- | ----------------------------- |
| quarter             | `Quarter` | `Q1`, `Q2`, `Q3`, `Q4`        |
| year                | `number`  | Calendar year                 |
| what_went_well      | `string`  | Highlights and wins           |
| improvements        | `string`  | Areas for growth              |
| kpi_summary         | `string`  | Summary of KPI progress       |
| generated_narrative | `string`  | AI-generated review narrative |

## CLI Commands

For full syntax details, see the [CLI Reference](/guide/cli-usage).

| Command              | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `rmbr goal add`      | Create a new goal from raw input                                |
| `rmbr goal list`     | List goals, optionally filter by status (`--include-deleted`)   |
| `rmbr goal show`     | Show a single goal by ID                                        |
| `rmbr goal activate` | Transition a goal to `active`                                   |
| `rmbr goal complete` | Mark a goal as completed                                        |
| `rmbr goal abandon`  | Abandon a goal                                                  |
| `rmbr goal delete`   | Soft-delete a goal (hidden from lists by default)               |
| `rmbr goal restore`  | Restore a soft-deleted goal                                     |
| `rmbr goal related`  | Show all entities linked to a goal (todos, kudos, study, slack) |
| `rmbr goal enrich`   | Enrich a goal with title, quarter, KPIs                         |
| `rmbr goal star`     | Add a STAR narrative to a goal                                  |
| `rmbr goal review`   | Generate or view a quarterly review                             |

## MCP Tools

| Tool                              | Description                                                    |
| --------------------------------- | -------------------------------------------------------------- |
| `rmbr_goal_create`                | Create a new goal; accepts optional enrichment fields          |
| `rmbr_goal_list`                  | List goals with optional status and quarter filters            |
| `rmbr_goal_get`                   | Get a single goal by ID                                        |
| `rmbr_goal_transition`            | Transition a goal to a new status                              |
| `rmbr_goal_delete`                | Soft-delete a goal                                             |
| `rmbr_goal_restore`               | Restore a soft-deleted goal                                    |
| `rmbr_goal_related`               | Get all entities linked to a goal (todos, kudos, study, slack) |
| `rmbr_goal_enrich`                | Enrich a raw goal with title, quarter, year, KPIs              |
| `rmbr_goal_add_star_narrative`    | Add a STAR narrative entry linked to a goal                    |
| `rmbr_goal_get_star_narratives`   | Retrieve all STAR narratives for a goal                        |
| `rmbr_goal_quarterly_review_data` | Gather goal data for a given quarter and year                  |
| `rmbr_goal_save_quarterly_review` | Save a quarterly review with summary and narrative             |
