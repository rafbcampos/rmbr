---
name: quarterly-review
description: 'Generate a quarterly goal review — aggregates goals, STAR narratives, and KPIs for a quarter, then synthesizes a review narrative. Trigger: quarterly review, Q1-Q4 review, end of quarter.'
---

# Quarterly Review

Guide the user through generating a comprehensive quarterly goal review.

## Workflow

1. **Determine quarter and year**: Ask the user which quarter (Q1-Q4) and year to review. Default to the current quarter if not specified.

2. **Gather data**: Call `rmbr_goal_quarterly_review_data` with the quarter and year. This returns all goals for that period, their STAR narratives, and any existing review.

3. **Collect STAR narratives**: For each goal returned, call `rmbr_goal_get_star_narratives` to get the detailed accomplishment stories.

4. **Analyze and synthesize**: Review all the data and generate:
   - **What went well**: Highlight completed goals, strong KPI performance, and impactful STAR stories
   - **Areas for improvement**: Note goals that were abandoned or didn't meet KPIs, and patterns to address
   - **KPI summary**: Aggregate KPI progress across all goals for the quarter
   - **Generated narrative**: A cohesive 2-3 paragraph review narrative suitable for a performance review document

5. **Present to user**: Show the draft review and ask for feedback. Iterate until the user is satisfied.

6. **Save the review**: Call `rmbr_goal_save_quarterly_review` with the finalized review data.

## MCP Tools Used

- `rmbr_goal_quarterly_review_data` — Get goals and narratives for a quarter
- `rmbr_goal_get_star_narratives` — Get STAR stories for each goal
- `rmbr_goal_save_quarterly_review` — Save the finalized review
- `rmbr_goal_list` — Supplementary goal queries if needed
