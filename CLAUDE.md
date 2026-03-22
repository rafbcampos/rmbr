# rmbr — CLI Second Brain for Work

## Runtime & Package Manager

- Use Bun exclusively (not Node.js)
- `bun run <script>` for npm scripts
- `bun:sqlite` for SQLite (not better-sqlite3)

## Commands

- `bun run check` — full quality gate (typecheck + lint + format + test)
- `bun run test` — bun test
- `bun run typecheck` — tsc --noEmit
- `bun run lint` — oxlint
- `bun run format` — prettier --check
- `bun run format:fix` — prettier --write

## Architecture

- Entity-per-module pattern: each module in `src/modules/<name>/`
- Modules implement `RmbrModule` interface (name, migrations, registerCommands, tools)
- Migration version ranges: todos 100-199, kudos 200-299, goals 300-399, til 400-499, study 500-599, slack 600-699, tags 700-799
- Drizzle ORM for all query-time database access (raw SQL migrations stay as-is)
- Branded types for all entity IDs
- Const object enums (not TypeScript enums)
- State transitions enforced via typed transition maps
- MCP create tools accept enrichment fields for single-step fully enriched entity creation

## Testing

- bun:test with `describe`/`it` blocks
- In-memory SQLite for all tests via `openMemoryDatabase()`
- Tests mirror src/ structure under `tests/`

## Code Style

- Prettier: single quotes, trailing commas, arrowParens avoid, 100 char width
- Strict TypeScript with exactOptionalPropertyTypes
- No hardcoded string checks — use typed constants
- No placeholder code or TODOs
