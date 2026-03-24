---
name: retro
description: 'Generate a retrospective report with time distribution analysis and estimation accuracy. Trigger: retro, retrospective, sprint report, time report, where did my time go.'
---

# Retrospective

Generate a structured retrospective report with time distribution analysis for any review period.

## Workflow

1. **Determine the period**: Ask the user what period to review (e.g., "this sprint", "last two weeks", "this month", "Q1"). Do not assume a fixed interval.

2. **Gather data**: Make parallel calls:
   - `rmbr_todo_estimate` — completed todos with actual duration
   - `rmbr_todo_list` with status `done` — all completed todos in the period
   - `rmbr_todo_list` with status `in_progress` — carry-over work
   - `rmbr_goal_list` with status `active` — active goals

3. **Get session details**: For each completed todo with significant time, call `rmbr_todo_get` to get the full session breakdown.

4. **Analyze**:
   - **Total time tracked**: Sum of all completed todo durations
   - **Time per goal**: Group completed work by associated goal
   - **Largest time sinks**: Top 5 todos by duration
   - **Average task duration by priority**: Break down mean time by priority level
   - **Estimation accuracy**: If estimates were previously provided by the LLM, compare estimated vs actual duration

5. **Format report**:
   - **Summary**: Brief overview of the period (tasks completed, total time)
   - **Time Distribution by Goal**: How time was allocated across goals
   - **Completed Work**: List of done todos with time spent
   - **Carry-Over**: In-progress work not completed in the period
   - **Estimation Accuracy**: Table of estimated vs actual where available
   - **Insights**: Patterns, surprises, areas for improvement

6. **Present to user**: Show the formatted report. The user can adjust the analysis or ask follow-up questions.

## MCP Tools Used

- `rmbr_todo_estimate` — Completed todos with duration data
- `rmbr_todo_list` — Query todos by status
- `rmbr_todo_get` — Session breakdown per todo
- `rmbr_goal_list` — Active goals for grouping
