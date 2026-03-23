# CLI Usage

rmbr is a CLI second brain for work. It is invoked as `rmbr <module> <command>` and the entry point is `bin/rmbr.ts`.

```bash
# General form
rmbr <module> <command> [arguments] [options]
```

## Pagination

Most `list` commands support pagination. The default page size is **20**. Use `--page <n>` to navigate pages and `--page-size <n>` to adjust the number of results per page.

---

## Todo

Manage your tasks through a full lifecycle: sketch, ready, in_progress, paused, done, or cancelled.

```bash
# Create a new todo from raw input
rmbr todo add "Fix the authentication bug in the login flow"

# List todos, optionally filtering by status
rmbr todo list
rmbr todo list --status in_progress
rmbr todo list --status done --page 2 --page-size 10

# Filter by due date
rmbr todo list --overdue
rmbr todo list --due-today
rmbr todo list --due-this-week

# Include soft-deleted todos
rmbr todo list --include-deleted

# Show a single todo as JSON
rmbr todo show <id>

# Transition a todo through its lifecycle
rmbr todo start <id>       # -> in_progress
rmbr todo pause <id>       # -> paused
rmbr todo done <id>        # -> done
rmbr todo cancel <id>      # -> cancelled

# Soft-delete and restore a todo
rmbr todo delete <id>
rmbr todo restore <id>

# Enrich a todo with structured data
rmbr todo enrich <id> --title "Fix auth bug" --priority high --due-date 2026-03-25 --goal-id <goal-id>
```

### Todo statuses

| Status        | Description                      |
| ------------- | -------------------------------- |
| `sketch`      | Initial capture, not yet refined |
| `ready`       | Refined and ready to work on     |
| `in_progress` | Currently being worked on        |
| `paused`      | Temporarily on hold              |
| `done`        | Completed                        |
| `cancelled`   | No longer needed                 |

---

## Goals

Track objectives with quarterly alignment, KPIs, and STAR narratives for performance reviews.

```bash
# Create a new goal
rmbr goal add "Improve API response times by 50%"

# List goals with filters
rmbr goal list
rmbr goal list -s active -q Q1 -y 2026
rmbr goal list -s completed -p 2 --page-size 5
rmbr goal list --include-deleted

# Show a goal
rmbr goal show <id>

# Transition a goal through its lifecycle
rmbr goal activate <id>    # -> active
rmbr goal complete <id>    # -> completed
rmbr goal abandon <id>     # -> abandoned

# Soft-delete and restore a goal
rmbr goal delete <id>
rmbr goal restore <id>

# Show all entities linked to a goal
rmbr goal related <id>

# Enrich a goal with structured data
rmbr goal enrich <id> -t "Improve API perf" -q Q1 -y 2026 -k '["p95 under 200ms", "zero timeouts"]'

# Add a STAR narrative (Situation, Task, Action, Result)
rmbr goal star <id> \
  --situation "API p95 latency was 800ms causing user complaints" \
  --task "Reduce p95 latency to under 200ms" \
  --action "Profiled hot paths, added caching layer, optimized DB queries" \
  --result "p95 dropped to 150ms, user complaints eliminated"

# Get quarterly review data
rmbr goal review -q Q1 -y 2026
```

### Goal statuses

| Status      | Description                           |
| ----------- | ------------------------------------- |
| `draft`     | Initial capture, not yet committed to |
| `active`    | Currently pursuing                    |
| `completed` | Successfully achieved                 |
| `abandoned` | No longer pursuing                    |

---

## Kudos

Record praise given and received to build a record of positive feedback.

```bash
# Create a kudos entry
rmbr kudos add "Maria helped me debug the deployment pipeline issue"

# List kudos, optionally filtering by direction
rmbr kudos list
rmbr kudos list --direction received
rmbr kudos list --direction given --page 2
rmbr kudos list --include-deleted

# Show a kudos entry
rmbr kudos show <id>

# Soft-delete and restore a kudos entry
rmbr kudos delete <id>
rmbr kudos restore <id>

# Enrich with structured data
rmbr kudos enrich <id> \
  --person "Maria" \
  --direction received \
  --summary "Helped debug deployment pipeline" \
  --context "During Q1 release crunch" \
  --goal-id <goal-id>
```

---

## TIL

Capture things you learn, organized by domain, with full-text search.

```bash
# Create a TIL entry
rmbr til add "PostgreSQL EXPLAIN ANALYZE shows actual vs estimated row counts"

# List TILs, optionally filtering by domain
rmbr til list
rmbr til list --domain databases --page 1
rmbr til list --include-deleted

# Show a TIL entry
rmbr til show <id>

# Full-text search across all TILs
rmbr til search "postgres explain"

# List all domains
rmbr til domains

# Soft-delete and restore a TIL entry
rmbr til delete <id>
rmbr til restore <id>

# Enrich with structured data
rmbr til enrich <id> \
  --title "EXPLAIN ANALYZE in PostgreSQL" \
  --content "Use EXPLAIN ANALYZE to compare estimated vs actual row counts" \
  --domain databases \
  --tags '["postgresql", "performance", "query-planning"]'
```

---

## Study

Track topics you want to learn, with notes and resources.

```bash
# Create a study topic
rmbr study add "Learn about Raft consensus algorithm"

# List study topics with filters
rmbr study list
rmbr study list --status in_progress
rmbr study list --domain "distributed-systems" --page 1 --page-size 10
rmbr study list --include-deleted

# Show a study topic
rmbr study show <id>

# Transition through the lifecycle
rmbr study start <id>     # -> in_progress
rmbr study done <id>      # -> completed
rmbr study park <id>      # -> parked

# Add a note to a study topic
rmbr study note <id> "Raft uses leader election with randomized timeouts"

# Add a resource URL
rmbr study resource <id> "https://raft.github.io/raft.pdf"

# Show the next queued topic
rmbr study next

# Soft-delete and restore a study topic
rmbr study delete <id>
rmbr study restore <id>

# Enrich with structured data
rmbr study enrich <id> --title "Raft Consensus" --domain "distributed-systems" --goal-id <goal-id>
```

### Study statuses

| Status        | Description          |
| ------------- | -------------------- |
| `queued`      | On the list to study |
| `in_progress` | Currently studying   |
| `completed`   | Finished studying    |
| `parked`      | Set aside for later  |

---

## Slack

Ingest and triage Slack messages for action tracking.

```bash
# Ingest a Slack message
rmbr slack ingest "Can you take a look at the PR?" \
  --channel general \
  --sender "alice" \
  --message-ts "1711100000.000100"

# List messages with filters
rmbr slack list
rmbr slack list --channel general
rmbr slack list --processed
rmbr slack list --sentiment positive --page 1
rmbr slack list --include-deleted

# Set sentiment on a message
rmbr slack sentiment <id> positive
rmbr slack sentiment <id> negative
rmbr slack sentiment <id> neutral

# Link a message to a todo or goal
rmbr slack link-todo <id> <todoId>
rmbr slack link-goal <id> <goalId>

# Mark a message as processed
rmbr slack process <id>

# Soft-delete and restore a slack message
rmbr slack delete <id>
rmbr slack restore <id>
```

---

## Tags

Apply freeform tags to any entity across all modules.

```bash
# Tag an entity (types: todo, kudos, goal, til, study, slack)
rmbr tag add "urgent" todo <entity_id>
rmbr tag add "q1-review" goal <entity_id>

# Remove a tag
rmbr tag remove "urgent" todo <entity_id>

# List all tags
rmbr tag list

# Get all entities with a given tag, optionally filtered by type
rmbr tag entities "urgent"
rmbr tag entities "q1-review" --type goal

# Show all tags for a specific entity
rmbr tag show todo <entity_id>
```

---

## Search

Search across all modules (todos, goals, kudos, TILs, study topics, slack messages) in a single query.

```bash
# Search across all entities
rmbr search "deployment pipeline"
```

---

## Skills

Manage bundled AI workflow skills for Claude Code.

```bash
# List all available skills
rmbr skill list

# Show a skill's full content
rmbr skill show weekly-standup

# Install all skills to ~/.claude/commands/ (available globally in Claude Code)
rmbr skill install

# Install a specific skill
rmbr skill install slack-process

# Install to the current project only
rmbr skill install --local

# Remove all rmbr skills
rmbr skill uninstall
```

Once installed, skills are available in Claude Code as `/rmbr-<name>` slash commands (e.g., `/rmbr-weekly-standup`).

### Available skills

| Skill                | Trigger examples                                      |
| -------------------- | ----------------------------------------------------- |
| `weekly-standup`     | "standup", "weekly update", "what did I do this week" |
| `quarterly-review`   | "quarterly review", "Q1 review", "end of quarter"     |
| `goal-plan`          | "plan goals", "quarterly planning", "OKR planning"    |
| `slack-process`      | "process slack", "slack triage", "inbox zero slack"   |
| `slack-ingest`       | "ingest slack", "fetch slack", "sync slack"           |
| `slack-setup`        | "setup slack", "configure slack mcp"                  |
| `study-session`      | "study", "learning session", "what should I study"    |
| `performance-review` | "performance review", "self-review", "review cycle"   |

---

## Common Workflows

### Capture, enrich, and complete a todo

```bash
# Capture a quick thought
rmbr todo add "Write integration tests for the payment module"

# Enrich it with details
rmbr todo enrich <id> \
  --title "Payment module integration tests" \
  --priority high \
  --due-date 2026-03-28 \
  --goal-id <goal-id>

# Start working on it
rmbr todo start <id>

# Mark it done
rmbr todo done <id>
```

### Track a goal through a quarter

```bash
# Create and activate a goal
rmbr goal add "Ship v2 of the billing system"
rmbr goal enrich <id> -t "Ship Billing v2" -q Q1 -y 2026 -k '["zero billing errors", "launch by March"]'
rmbr goal activate <id>

# Add a STAR narrative when complete
rmbr goal complete <id>
rmbr goal star <id> \
  --situation "Legacy billing had frequent calculation errors" \
  --task "Rebuild billing with full test coverage" \
  --action "Rewrote calculation engine, added property-based tests" \
  --result "Zero billing errors since launch, shipped 2 weeks early"

# Pull review data at end of quarter
rmbr goal review -q Q1 -y 2026
```

### Learn something and file it

```bash
# Capture a TIL
rmbr til add "Bun supports SQLite natively via bun:sqlite"

# Enrich it
rmbr til enrich <id> \
  --title "Bun native SQLite" \
  --domain "bun" \
  --tags '["sqlite", "runtime"]'

# Find it later
rmbr til search "bun sqlite"
```
