---
name: standup
description: 'Generate a standup update from recent todo activity with time tracking data. Trigger: standup, daily update, status update, what am I working on, what did I do.'
---

# Standup

Generate a structured standup summary from the user's rmbr data for any time period.

## Workflow

1. **Determine the period**: Ask the user what period to cover (e.g., "since yesterday", "this week", "since last Monday", "today"). Do not assume a fixed interval.

2. **Query recent activity**: Make parallel calls to gather data for the period:
   - `rmbr_todo_list` with status `done` — completed tasks
   - `rmbr_todo_list` with status `in_progress` — current work
   - `rmbr_todo_list` with status `paused` — blocked/paused items
   - `rmbr_goal_list` with status `active` — active goals for context
   - `rmbr_kudos_list` — recent kudos given/received
   - `rmbr_til_list` — recent learnings

3. **Enrich with time data**: For each in-progress and done todo, call `rmbr_todo_get` to retrieve:
   - `total_elapsed_seconds` — total time spent
   - `time_entries` — individual session details

4. **Filter by period**: From the results, identify items created or updated within the requested period (by checking `created_at` and `updated_at` timestamps).

5. **Synthesize standup**: Organize into format:
   - **Done**: Tasks completed in the period, with time spent (e.g., "Completed API refactor (2h 30m)"), grouped by goal if possible
   - **In Progress**: Current active work with time spent so far (e.g., "Working on auth migration (1h 15m so far)")
   - **Blockers**: Paused todos or stalled items
   - **Highlights**: Notable kudos received, key learnings from TILs

6. **Present to user**: Show the formatted standup. The user can copy it directly or ask for adjustments.

## MCP Tools Used

- `rmbr_todo_list` — Query todos by status
- `rmbr_todo_get` — Get time tracking details per todo
- `rmbr_goal_list` — Get active goals for context
- `rmbr_kudos_list` — Recent recognition
- `rmbr_til_list` — Recent learnings
