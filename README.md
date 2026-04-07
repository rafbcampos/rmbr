# rmbr

A local-first CLI and TUI for tracking work. Stores todos, goals, kudos, and learnings in a SQLite database on your machine. Generates standup, retrospective, and performance review reports as markdown.

All data stays local. No cloud, no sync, no accounts.

## Install

Requires Rust 1.85+ (edition 2024).

```bash
git clone https://github.com/rafaelcampos/rmbr.git
cd rmbr
cargo install --path .
rmbr --version
```

To uninstall:

```bash
cargo uninstall rmbr
rm -rf ~/.local/share/rmbr    # Linux — delete database
rm -rf ~/Library/Application\ Support/rmbr  # macOS
```

## Concepts

### Todo

A unit of work with time tracking. See [Time tracking](#time-tracking) for details on how elapsed time is recorded.

| Field       | Type   | Notes                                                   |
| ----------- | ------ | ------------------------------------------------------- |
| title       | string | required                                                |
| description | string | optional                                                |
| status      | enum   | `pending`, `in-progress`, `paused`, `done`, `cancelled` |
| priority    | enum   | `low`, `medium`, `high`, `urgent`                       |
| due_date    | date   | optional, YYYY-MM-DD                                    |
| tags        | list   | selected from existing [tags](#tags) or auto-created    |

**Status transitions** are enforced. Each state can only transition to specific states:

```
pending      -> in-progress, cancelled
in-progress  -> paused, done, cancelled
paused       -> in-progress, cancelled
done         (terminal)
cancelled    (terminal)
```

From `paused`, you must resume (`paused -> in-progress`) before marking done.

### Goal

A goal following the STAR framework (Situation, Task, Action, Result). The four STAR fields are optional and meant to be filled progressively — set Situation and Task when creating, fill Action as you work, write Result at completion.

| Field     | Type   | Notes                                                 |
| --------- | ------ | ----------------------------------------------------- |
| title     | string | required                                              |
| situation | string | optional — context, why this goal matters             |
| task      | string | optional — what specifically needs to be done         |
| action    | string | optional — how you approached it                      |
| result    | string | optional — outcome and impact                         |
| status    | enum   | `not-started`, `in-progress`, `achieved`, `abandoned` |
| due_date  | date   | optional, typically ~6 months out                     |
| tags      | list   | selected from existing [tags](#tags) or auto-created  |

Goals link to todos (many-to-many). Linked todos serve as evidence of work toward the goal. The `goal show` command and the review report display linked todos with their completion status and time tracked.

Goals link to kudos (many-to-many). Linked kudos serve as external validation of progress.

STAR completeness is tracked (0/4 to 4/4) and shown in list views and reports.

### Kudo

Recognition given or received. Tracks both directions — kudos you received from others and kudos you gave.

| Field       | Type   | Notes                                                   |
| ----------- | ------ | ------------------------------------------------------- |
| title       | string | required — short summary                                |
| description | string | optional                                                |
| from_name   | string | optional — who gave the kudo                            |
| from_slack  | string | optional — their Slack handle                           |
| to_name     | string | optional — who received it (displayed as "me" if empty) |
| to_slack    | string | optional                                                |
| date        | date   | defaults to today                                       |
| tags        | list   | selected from existing [tags](#tags) or auto-created    |

Kudos link to goals (many-to-many). When linked, they appear in the review report as validation for that goal.

### TIL (Today I Learned)

A knowledge entry — something you learned on the job.

| Field    | Type   | Notes                                                     |
| -------- | ------ | --------------------------------------------------------- |
| title    | string | required                                                  |
| body     | string | required — the actual learning                            |
| source   | string | optional — where you learned it (URL, book, conversation) |
| category | enum   | `technical`, `process`, `domain`, `people`                |
| tags     | list   | selected from existing [tags](#tags) or auto-created      |

TILs are standalone — they do not link to goals or todos.

### Tags

Tags are stored in a `tags` table. They are created explicitly via `rmbr tag add` or auto-created when used with `--tag` on add/edit commands. Tags are shared across all entity types. Using `--tag` on an `edit` command **replaces** all existing tags on that entity.

```bash
rmbr tag add backend
rmbr tag list              # shows name + usage count across all entities
rmbr tag delete 1          # cascades — removes tag from all linked entities
```

### Relationships

```
Goal <-- todo_goals --> Todo
Goal <-- kudo_goals --> Kudo
TIL (standalone, no links)
```

- A todo can be linked to multiple goals, and a goal can have multiple linked todos.
- A kudo can be linked to multiple goals, and a goal can have multiple linked kudos.
- Links are created via `--goal` flag on `todo add` / `kudo add`, `--todo` flag on `goal link`, or `--goal` flag on `kudo link`.
- TILs have no relationship links.

## Usage

### TUI

Running `rmbr` with no subcommand opens an interactive TUI dashboard. Running `rmbr todo`, `rmbr goal`, `rmbr kudo`, or `rmbr til` with no subcommand opens the TUI for that entity.

**Dashboard** shows: entity counts, in-progress todos, recent goals, recent kudos, recent TILs. Press `t`/`g`/`k`/`l` to navigate to entity views. Press `/` for global fuzzy search across all entities.

**Entity list views** support:

| Key                 | Action                                      |
| ------------------- | ------------------------------------------- |
| `j`/`k` or Up/Down  | Navigate                                    |
| `g`/`G` or Home/End | Jump to first/last item                     |
| `Enter`             | View details                                |
| `a`                 | Add new                                     |
| `e`                 | Edit selected                               |
| `/`                 | Fuzzy search (type to filter, Esc to clear) |
| `Delete`            | Soft-delete selected                        |
| `d`                 | Toggle show/hide deleted items              |
| `R`                 | Restore a soft-deleted item                 |
| `Esc`/`q`           | Go back                                     |

**Todo-specific keys** (in list view):

| Key | Action                         |
| --- | ------------------------------ |
| `s` | Start (pending -> in-progress) |
| `p` | Pause (in-progress -> paused)  |
| `r` | Resume (paused -> in-progress) |
| `D` | Done (in-progress -> done)     |
| `x` | Cancel                         |

**Detail views** show full entity data. For todos: time entries and total duration. For goals: STAR fields and linked todos. For kudos: linked goals. Press `L` in todo or kudo detail to open a goal picker for linking.

**Forms** (add/edit) use Tab to move between fields, Enter to submit (on last field), Esc to cancel. Select fields (priority, status, category) cycle with Left/Right arrows. Tags are entered as comma-separated values.

### CLI

Every operation is available via CLI flags. No TUI interaction required.

**Todos:**

```bash
rmbr todo add "Fix login bug" --priority urgent --due 2026-04-10 --tag backend
rmbr todo list
rmbr todo list --status in-progress --priority high --tag backend
rmbr todo list --due-before 2026-05-01 --due-after 2026-04-01
rmbr todo list --deleted                    # include soft-deleted
rmbr todo show 1                            # details + time entries + duration
rmbr todo edit 1 --title "New title" --tag new-tag  # --tag replaces all tags
rmbr todo start 1
rmbr todo pause 1
rmbr todo resume 1
rmbr todo done 1
rmbr todo cancel 1
rmbr todo delete 1                          # soft-delete
rmbr todo restore 1                         # undo soft-delete
rmbr todo purge 1                           # permanent delete
rmbr todo purge --all                       # purge all soft-deleted
rmbr todo purge --all --older-than 90d      # purge deleted older than 90 days
```

**Goals:**

```bash
rmbr goal add "Ship feature X" --situation "Team needs X" --task "Build and ship" --due 2026-10-01 --tag q3
rmbr goal list
rmbr goal list --status in-progress --tag q3 --due-before 2026-12-01
rmbr goal list --deleted
rmbr goal show 1                            # STAR fields + linked todos + progress
rmbr goal edit 1 --action "Built in Rust" --result "Shipped on time" --status achieved
rmbr goal link 1 --todo 5                   # link todo as evidence
rmbr goal unlink 1 --todo 5
rmbr goal delete 1
rmbr goal restore 1
rmbr goal purge 1
rmbr goal purge --all --older-than 90d
```

**Kudos:**

```bash
rmbr kudo add "Helped debug prod" --from "Alice" --from-slack "@alice" --goal 1
rmbr kudo list
rmbr kudo list --from Alice --to Bob --after 2026-01-01 --before 2026-07-01 --tag teamwork
rmbr kudo list --deleted
rmbr kudo show 1                            # details + linked goals
rmbr kudo edit 1 --title "Updated" --tag peer-review
rmbr kudo link 1 --goal 2                   # link to a goal
rmbr kudo unlink 1 --goal 2
rmbr kudo delete 1
rmbr kudo restore 1
rmbr kudo purge 1
rmbr kudo purge --all
```

**TILs:**

```bash
rmbr til add "Rust lifetimes" --body "References must outlive borrows" --source "Rust Book Ch10" --category technical --tag rust
rmbr til list
rmbr til list --category process --after 2026-01-01 --before 2026-07-01 --tag onboarding
rmbr til list --deleted
rmbr til show 1
rmbr til edit 1 --body "Updated explanation" --tag updated
rmbr til delete 1
rmbr til restore 1
rmbr til purge 1
rmbr til purge --all --older-than 90d
```

**Tags:**

```bash
rmbr tag add backend
rmbr tag list                               # name + usage count
rmbr tag delete 1                           # cascades from all entities
```

**Config:**

```bash
rmbr config set standup.days mon,wed,fri
rmbr config set retro.period_weeks 2
rmbr config set review.period_months 6
rmbr config get standup.days
rmbr config list
rmbr config delete standup.days
```

### Reports

All reports output markdown to stdout. Pipe to clipboard, redirect to file, or paste into Slack/Confluence.

**Standup** — uses `standup.days` config to determine "since last standup" date.

```bash
rmbr standup
rmbr standup --since 2026-04-01
```

Sections:

- **Done** — completed todos with time tracked and tags
- **In Progress** — active todos with time tracked
- **Up Next** — pending todos sorted by priority (up to 10)

**Retro** — default period: last 2 weeks (configurable via `retro.period_weeks`).

```bash
rmbr retro
rmbr retro --last 2w                        # last 2 weeks
rmbr retro --last 1m                        # last 1 month (~30 days)
rmbr retro --since 2026-03-01
```

`--last` accepts `Nw` (weeks) or `Nm` (months, approximated as N\*30 days).

Sections:

- **Completed Work** — todos with time tracked and tags, plus total
- **Kudos** — given/received with from/to and date
- **Learnings (TIL)** — title and category
- **Goal Progress** — STAR completeness and % of linked todos done per goal

**Review** — default period: last 6 months (configurable via `review.period_months`).

```bash
rmbr review
rmbr review --half H1                       # Jan 1 to today
rmbr review --half H2                       # Jul 1 to today
rmbr review --since 2026-01-01
```

Structure:

- **Goals** — each goal gets a section with STAR fields, linked todos as evidence (completion status + time), linked kudos as validation, and progress fraction
- **Other Kudos** — kudos not linked to any goal
- **Growth & Learning** — TILs grouped by category (Technical, Process, Domain, People) with sources

## Time tracking

Time tracking is event-log based. Each status transition records a timestamped entry in `todo_time_entries`:

| Action   | Records          |
| -------- | ---------------- |
| `start`  | Start timestamp  |
| `pause`  | Pause timestamp  |
| `resume` | Resume timestamp |
| `done`   | Done timestamp   |
| `cancel` | Cancel timestamp |

Duration is calculated by summing active intervals (start-to-pause, resume-to-done, etc.). If the todo is currently in-progress (open interval), the TUI shows live elapsed time using the current wall clock.

No background process or daemon. Timestamps persist in SQLite across terminal sessions and reboots.

## Soft delete

All entities support soft delete via a `deleted_at` timestamp.

- `delete` sets `deleted_at` — item hidden from default views
- `restore` clears `deleted_at` — item visible again
- `purge <id>` permanently removes a single row
- `purge --all` removes all soft-deleted items of that entity type
- `purge --all --older-than 90d` removes items deleted more than 90 days ago
- `list --deleted` (CLI) or `d` key (TUI) shows soft-deleted items
- All four entity types (todo, goal, kudo, til) support these operations

Soft-deleted items are excluded from reports.

## Data storage

SQLite database, one file:

| OS    | Default path                                 |
| ----- | -------------------------------------------- |
| Linux | `~/.local/share/rmbr/rmbr.db`                |
| macOS | `~/Library/Application Support/rmbr/rmbr.db` |

Override with `RMBR_DB_PATH` environment variable:

```bash
RMBR_DB_PATH=/tmp/test.db rmbr todo list
```

The database and parent directories are created automatically on first run. Schema migrations run automatically via `PRAGMA user_version`.

## Config

Config is stored in the same SQLite database as a key-value table.

| Key                    | Default               | Used by                                                          |
| ---------------------- | --------------------- | ---------------------------------------------------------------- |
| `standup.days`         | `mon,tue,wed,thu,fri` | `rmbr standup` — determines "since last standup" date            |
| `retro.period_weeks`   | `2`                   | `rmbr retro` — default lookback when no `--since`/`--last` flag  |
| `review.period_months` | `6`                   | `rmbr review` — default lookback when no `--half`/`--since` flag |

## Development

```bash
cargo test                    # 184 tests
cargo clippy -- -D warnings   # zero warnings
cargo run                     # launch TUI
cargo run -- --help           # all commands
```

## License

MIT
