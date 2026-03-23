---
name: performance-review
description: 'Generate a comprehensive performance review narrative from goals, STAR stories, kudos, and learnings across a review period. Trigger: performance review, self-review, review cycle, annual review.'
---

# Performance Review

Generate a comprehensive self-review narrative by aggregating accomplishments, recognition, and growth across a review period.

## Workflow

1. **Determine review period**: Ask the user for the time range (e.g., Q1-Q2 2025, full year 2025). Determine which quarters to cover.

2. **Gather evidence**: Make parallel calls for each quarter in the period:
   - `rmbr_goal_list` — All goals with their statuses and KPIs
   - `rmbr_goal_get_star_narratives` — STAR stories for each goal
   - `rmbr_kudos_list` — All kudos given and received
   - `rmbr_til_list` — All learnings and skill development
   - `rmbr_goal_related` — Related entities for key goals

3. **Analyze and categorize**:
   - **Accomplishments**: Completed goals, met KPIs, STAR narratives
   - **Impact**: Kudos received, goals where others depended on the user's work
   - **Collaboration**: Kudos given, team contributions visible in STAR narratives
   - **Growth**: TIL entries, study topics completed, new skills developed
   - **Areas for improvement**: Abandoned goals, missed KPIs, patterns in challenges

4. **Generate narrative**: Write a structured performance review with sections:
   - **Summary**: 2-3 sentence overview of the period
   - **Key accomplishments**: Top 3-5 achievements with STAR evidence
   - **Impact and recognition**: How the user's work affected others
   - **Skills and growth**: New capabilities developed
   - **Looking ahead**: Goals and focus areas for the next period

5. **Review and iterate**: Present the draft to the user. Incorporate feedback until they're satisfied.

## MCP Tools Used

- `rmbr_goal_list` — Goals for the period
- `rmbr_goal_get_star_narratives` — Accomplishment stories
- `rmbr_goal_related` — Related work items per goal
- `rmbr_kudos_list` — Recognition data
- `rmbr_til_list` — Learning evidence
- `rmbr_goal_quarterly_review_data` — Existing quarterly reviews
