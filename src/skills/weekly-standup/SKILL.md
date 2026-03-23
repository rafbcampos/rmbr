---
name: weekly-standup
description: 'Synthesize a weekly standup update from recent todos, goals, kudos, and TILs. Trigger: standup, weekly update, status update, what did I do this week.'
---

# Weekly Standup

Generate a structured weekly standup summary from the user's rmbr data.

## Workflow

1. **Query recent activity**: Make parallel calls to gather this week's data:
   - `rmbr_todo_list` with status `done` — completed tasks
   - `rmbr_todo_list` with status `in_progress` — current work
   - `rmbr_goal_list` with status `active` — active goals for context
   - `rmbr_kudos_list` — recent kudos given/received
   - `rmbr_til_list` — recent learnings

2. **Filter based on the standups interval**: From the results, identify items created or updated in the current week (by checking `created_at` and `updated_at` timestamps).

3. **Synthesize standup**: Organize into the standard standup format:
   - **Done**: Tasks completed this week, grouped by goal if possible
   - **In Progress**: Current active work
   - **Blockers**: Any paused todos or stalled items (infer from paused status)
   - **Highlights**: Notable kudos received, key learnings from TILs

4. **Present to user**: Show the formatted standup. The user can copy it directly or ask for adjustments.

## MCP Tools Used

- `rmbr_todo_list` — Query todos by status
- `rmbr_goal_list` — Get active goals
- `rmbr_kudos_list` — Recent recognition
- `rmbr_til_list` — Recent learnings
