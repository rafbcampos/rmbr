# Core Concepts

## Entities

Every module in rmbr manages a specific type of entity — todos, goals, kudos, TILs, study topics, Slack messages, or tags. All entities are stored in a local SQLite database at `~/.rmbr/rmbr.db` using Drizzle ORM for query-time access.

Each module owns a dedicated migration version range to avoid conflicts:

| Module | Version Range |
| ------ | ------------- |
| Todos  | 100-199       |
| Kudos  | 200-299       |
| Goals  | 300-399       |
| TIL    | 400-499       |
| Study  | 500-599       |
| Slack  | 600-699       |
| Tags   | 700-799       |

## Enrichment

rmbr uses a two-phase data capture model:

1. **Capture**: Record a raw thought or input as quickly as possible. The entity is created with an enrichment status of `raw`.
2. **Enrich**: Structure the raw input with fields like title, priority, domain, and more. Once enriched, the status becomes `enriched`.

This separation lets you capture ideas in the moment without worrying about structure. Enrichment can happen later, either manually or through AI.

MCP create tools support single-step enriched creation, allowing an AI assistant to capture and structure data in one call.

## Branded Types

All entity IDs use branded types — `TodoId`, `GoalId`, `KudosId`, and so on. A branded type is a TypeScript pattern that makes structurally identical types (like two `number` values) distinguishable at the type level.

This prevents a common class of bugs: accidentally passing a `TodoId` where a `GoalId` is expected. The compiler catches the mistake before it reaches runtime.

## Status Transitions

Entities that have statuses (such as todos and goals) use typed transition maps to enforce valid state changes. Not every transition is allowed. For example, a todo cannot go from `done` back to `sketch`.

The transition map is defined as a const object, so the compiler knows exactly which transitions are legal. Attempting an invalid transition results in a type error.

## Const Object Enums

rmbr does not use TypeScript `enum` declarations. Instead, it uses `as const` objects to define sets of related values:

```typescript
const TodoStatus = {
  Sketch: 'sketch',
  Ready: 'ready',
  InProgress: 'in_progress',
  Paused: 'paused',
  Done: 'done',
  Cancelled: 'cancelled',
} as const;
```

This approach provides the same type safety as enums with better runtime behavior — the values are plain strings, they work naturally with JSON serialization, and they avoid the quirks of TypeScript's enum implementation.

## Soft-Delete

Every entity supports soft-delete. When you delete an entity, it sets a `deleted_at` timestamp rather than removing the row from the database. Soft-deleted entities are hidden from list commands by default but can be included with the `--include-deleted` flag. Deleted entities can be restored at any time with the `restore` command, which clears the `deleted_at` timestamp.

## Module System

Every module implements the `RmbrModule` interface, which requires four members:

- **name**: A unique string identifier for the module.
- **migrations**: SQL migration statements scoped to the module's version range.
- **registerCommands**: CLI command definitions for the module (e.g., `todo add`, `todo list`).
- **tools**: MCP tool definitions that expose the module's functionality to AI assistants.

Modules are registered in a central registry. This pattern keeps each module self-contained while allowing the system to discover and initialize all modules uniformly.

## Tags

Tags are a cross-cutting module. Any entity from any other module can be tagged, providing a flexible way to organize and filter across different entity types.

For example, you can tag a todo, a goal, and a TIL entry all with the same tag to group related items regardless of their module. Tags are their own module with their own migrations and commands, following the same `RmbrModule` interface as everything else.
