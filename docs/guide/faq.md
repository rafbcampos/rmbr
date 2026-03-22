# FAQ

## Where is my data stored?

All data lives in `~/.rmbr/rmbr.db`, a local SQLite database. Nothing is sent to the cloud.
Your data stays on your machine.

## Can I back up my data?

Yes. Copy the `~/.rmbr/rmbr.db` file to a safe location. Since it is a single SQLite file,
standard file-copy tools work fine. You can also keep it in a synced folder or version-control
it if you like.

## What is enrichment?

Enrichment is rmbr's two-phase capture model. You jot down raw input quickly (phase one), then
add structured fields like title, priority, tags, and links later (phase two). The second phase
can happen manually through the CLI or automatically when an AI assistant processes your input.
See the [Enrichment guide](/guide/enrichment) for details.

## What is MCP?

Model Context Protocol is an open standard that lets AI assistants call external tools. rmbr
runs an MCP server over stdio, so any MCP-compatible assistant (Claude Desktop, VS Code with
Copilot, etc.) can create todos, log kudos, record TILs, and more — all by calling rmbr's
tools directly.

## Can I use rmbr without AI?

Absolutely. The CLI is fully standalone. You can add todos, track goals, give kudos, and
record TILs entirely from the command line. AI integration via MCP simply makes enrichment
and data entry faster.

## What are branded types?

Branded types are type-safe numeric IDs that prevent mixing different entity types at compile
time. A `TodoId` and a `GoalId` are both numbers at runtime, but TypeScript treats them as
incompatible types. This catches bugs like passing a todo ID where a goal ID is expected.

## How do I link entities?

- **Todos** can link to goals via `goal_id`.
- **Study topics** can link to goals via `goal_id`.
- **Kudos** can link to goals via `goal_id`.
- **Slack messages** can link to both todos and goals.
- **Tags** work across all entity types through a polymorphic tagging system.

## What is a STAR narrative?

STAR stands for Situation-Task-Action-Result. It is a framework for documenting achievements
in a structured way. In rmbr, you can attach STAR narratives to goals, making it easy to
prepare for performance reviews with concrete, well-organized examples of your work.

## Can I search my data?

Yes. TIL supports full-text search across titles and content. All modules support filtered
lists — you can filter by status, domain, quarter, priority, and other module-specific fields.
