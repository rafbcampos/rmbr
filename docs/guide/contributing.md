# Contributing

## Prerequisites

- [Bun](https://bun.sh/) runtime
- TypeScript 5+

## Setup

```bash
git clone https://github.com/rafbcampos/rmbr.git
cd rmbr
bun install
```

`bun install` automatically registers the `rmbr` command on your PATH via `bun link`.

## Development Commands

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `bun run check`      | Full quality gate (typecheck + lint + format + test) |
| `bun run test`       | Run tests                                            |
| `bun run typecheck`  | Type-check with `tsc --noEmit`                       |
| `bun run lint`       | Lint with oxlint                                     |
| `bun run format`     | Check formatting with Prettier                       |
| `bun run format:fix` | Auto-fix formatting with Prettier                    |

Always run `bun run check` before submitting a pull request. It runs the full quality gate
in one command.

## Testing

Tests use `bun:test` with `describe`/`it` blocks. Every test gets an in-memory SQLite database
via `openMemoryDatabase()`, so tests are fast and isolated.

The test directory mirrors the source structure:

```
src/modules/todo/service.ts
tests/modules/todo/service.test.ts
```

## Code Style

Prettier is configured with:

- Single quotes
- Trailing commas
- `arrowParens: avoid`
- 100 character line width

TypeScript is set to strict mode with `exactOptionalPropertyTypes` enabled. Additional rules:

- No `enum` keyword — use const object enums instead.
- No hardcoded string checks — use typed constants.
- No `unknown`, `as`, or `any` — use proper types or type guards.
- No placeholder code or TODOs.

## Adding a Module

1. Create a directory at `src/modules/<name>/`.
2. Implement the `RmbrModule` interface with `name`, `migrations`, `tools`, and
   `registerCommands`.
3. Choose a migration version range (see [Architecture](/guide/architecture) for the range
   table).
4. Add a `drizzle-schema.ts` for your table definitions.
5. Add a `service.ts` with business logic.
6. Register your module in `src/registry.ts`.
7. Add tests under `tests/modules/<name>/`.
