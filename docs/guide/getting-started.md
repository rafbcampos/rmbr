# Getting Started

## Prerequisites

rmbr runs on [Bun](https://bun.sh), a fast JavaScript runtime. Install Bun before proceeding:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/rafbcampos/rmbr.git
cd rmbr
bun install
```

`bun install` automatically registers the `rmbr` command on your PATH via `bun link`, so you can use it from anywhere in your terminal.

## First Run

Create your first todo and list it:

```bash
rmbr todo add "My first todo"
rmbr todo list
```

rmbr automatically creates its SQLite database at `~/.rmbr/rmbr.db` on first run. No configuration or setup is needed.

## Quick Tour of Modules

rmbr ships with seven built-in modules. Here is one example command for each:

### Todos

Track tasks and action items.

```bash
rmbr todo add "Review pull request for auth service"
```

### Goals

Capture objectives and attach STAR narratives for performance reviews.

```bash
rmbr goal add "Reduce API latency by 30%"
```

### Kudos

Record praise and recognition you give or receive.

```bash
rmbr kudos add "Sara debugged the production outage in 20 minutes"
```

### TIL (Today I Learned)

Store things you learn as searchable entries.

```bash
rmbr til add "Bun supports SQLite natively via bun:sqlite"
```

### Study

Track topics you want to study or are actively studying.

```bash
rmbr study add "Distributed consensus algorithms"
```

### Slack

Ingest and store important Slack messages for later reference.

```bash
rmbr slack ingest "Deploy went smoothly, zero downtime" --channel "#engineering"
```

### Tags

Tag any entity from any module for cross-cutting organization.

```bash
rmbr tag add "urgent" todo 1
```

## Install Skills for Claude Code

If you use Claude Code, install rmbr's AI workflow skills as slash commands:

```bash
rmbr skill install
```

This gives you commands like `/rmbr-weekly-standup`, `/rmbr-slack-process`, `/rmbr-goal-plan`, and more. See `rmbr skill list` for all available skills.

## Next Steps

- [CLI Usage](/guide/cli-usage) — Full reference for all commands and options
- [MCP Setup](/guide/mcp-setup) — Connect rmbr to your AI assistant via MCP
- [Core Concepts](/guide/core-concepts) — Understand the architecture behind rmbr
