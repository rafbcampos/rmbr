# Enrichment

Enrichment is rmbr's two-phase data capture model. You capture raw input quickly, then add
structured detail later — either manually or with AI assistance.

## Two-Phase Data Capture

The core idea: **capture first, organize later**.

1. **Raw phase** — jot down a thought as fast as possible. No required fields beyond the
   raw text.
2. **Enrichment phase** — when you have time (or an AI assistant does it for you), add
   structured fields like title, priority, domain, tags, and links to goals.

This removes friction from the capture moment while still producing well-structured data.

## Enrichment Status

Every entity carries an `enrichment_status` field:

| Status     | Meaning                                   |
| ---------- | ----------------------------------------- |
| `raw`      | Just created, only has unstructured input |
| `enriched` | Structured fields have been filled in     |

## Enrichment Fields Per Module

Each module defines its own enrichment fields:

### Todos

- `title` — concise summary of the task
- `priority` — low, medium, high, or critical
- `due_date` — deadline
- `goal_id` — link to a parent goal

### Goals

- `title` — goal name
- `quarter` — Q1, Q2, Q3, or Q4
- `year` — target year
- `kpis` — JSON array of key performance indicators

### Kudos

- `direction` — given or received
- `person` — who the kudos involves
- `summary` — what happened
- `context` — additional detail
- `goal_id` — link to a related goal

### TIL (Today I Learned)

- `title` — what you learned
- `content` — detailed explanation
- `domain` — subject area
- `tags` — JSON array of topic tags

### Study

- `title` — topic name
- `domain` — subject area
- `goal_id` — link to a related goal

## Single-Step Creation

MCP create tools accept enrichment fields directly alongside the raw input. This means an AI
assistant can create a fully enriched entity in a single call instead of the two-step
create-then-enrich flow.

**Example:** a user says:

> I need to fix the login bug by Friday, high priority

The AI calls the todo create tool with:

```json
{
  "raw_input": "I need to fix the login bug by Friday, high priority",
  "title": "Fix login bug",
  "priority": "high",
  "due_date": "2026-03-27"
}
```

The resulting todo is created with `enrichment_status: 'enriched'` immediately — no second
step needed.

## Enrichment Prompts

Each module provides an enrichment prompt that guides AI assistants on how to extract
structured data from raw input. These prompts are defined in `src/core/prompts.ts` and tell
the AI what fields to look for, what formats to use, and what to leave blank when information
is missing.

## Shared Enrichment Logic

The utility function `enrichEntity()` in `src/shared/enrichment.ts` handles the common pattern
of updating a record's structured fields and flipping its `enrichment_status` from `raw` to
`enriched`. Individual module services call this utility so enrichment behavior stays
consistent across the codebase.
