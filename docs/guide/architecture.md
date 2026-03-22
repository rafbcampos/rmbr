# Architecture

rmbr follows an entity-per-module architecture where each domain concept lives in its own
self-contained module. A central registry wires modules together, exposing them through both
a CLI and an MCP server.

## Module System

Each module lives in `src/modules/<name>/` and implements the `RmbrModule` interface:

```ts
interface RmbrModule {
  name: string;
  migrations: Migration[];
  tools: McpToolDefinition[];
  registerCommands(program: Command, db: DrizzleDatabase): void;
}
```

The central registry in `src/registry.ts` (which imports from `src/core/registry.ts`) collects all modules and hands them to the CLI
(commander) and MCP server (stdio transport). This means every module automatically gets both
a CLI subcommand and a set of MCP tools with no extra wiring.

## Migration Ranges

Each module owns a reserved version range for its raw SQL migrations:

| Module | Range   |
| ------ | ------- |
| Todos  | 100-199 |
| Kudos  | 200-299 |
| Goals  | 300-399 |
| TIL    | 400-499 |
| Study  | 500-599 |
| Slack  | 600-699 |
| Tags   | 700-799 |

Migrations are plain SQL strings executed in version order. Drizzle is **not** used for
migrations — only for query-time access.

## Drizzle ORM

Every module has a `drizzle-schema.ts` that defines its tables. All runtime queries go through
Drizzle, giving us type-safe selects, inserts, and updates without writing raw SQL at the
application layer.

## Branded Types

Entity IDs use branded types to prevent accidental mixing at compile time:

```ts
type TodoId = Brand<number, 'TodoId'>;
type GoalId = Brand<number, 'GoalId'>;
```

A unique symbol brand on each type means you cannot pass a `GoalId` where a `TodoId` is
expected, even though both are numbers at runtime.

## Const Object Enums

rmbr uses const object enums instead of the TypeScript `enum` keyword:

```ts
const TodoStatus = {
  Sketch: 'sketch',
  Ready: 'ready',
  InProgress: 'in_progress',
  Paused: 'paused',
  Done: 'done',
  Cancelled: 'cancelled',
} as const;
```

This pattern produces plain objects that are fully erasable, tree-shakeable, and compatible
with exact string literal types.

## State Transitions

Typed transition maps enforce which status changes are valid:

```ts
const VALID_TRANSITIONS: Record<TodoStatus, readonly TodoStatus[]> = {
  sketch: ['ready', 'cancelled'],
  ready: ['in_progress', 'cancelled'],
  in_progress: ['paused', 'done', 'cancelled'],
  paused: ['in_progress', 'cancelled'],
  done: [],
  cancelled: [],
};
```

Attempting an invalid transition is caught at the type level and rejected at runtime by the
service layer.

## Service Layer

Each module has a `service.ts` containing all business logic — status transitions, enrichment,
queries, and validation. Both CLI commands and MCP tools delegate to the same service
functions, keeping behavior consistent across interfaces.

## Dual Interface

rmbr exposes two interfaces that share a single service layer:

- **CLI** — built with commander. Each module registers subcommands
  (e.g. `rmbr todo add`, `rmbr goal list`).
- **MCP** — a Model Context Protocol server over stdio. Each module exports tool definitions
  that AI assistants can call directly.

Because both interfaces call the same services, every feature works identically whether you
type it or an AI invokes it.

## Database

SQLite via `bun:sqlite`. The database lives at `~/.rmbr/rmbr.db` and is created automatically
on first run. Tests use in-memory databases via `openMemoryDatabase()` so they run fast and
leave no artifacts.
