---
name: goal-plan
description: 'Conversational goal planning — brainstorm goals, suggest KPIs, create enriched goals, and link related todos and study topics. Trigger: plan goals, set objectives, quarterly planning, OKR planning.'
---

# Goal Planning

Guide the user through designing and creating quarterly goals with measurable KPIs.

## Workflow

1. **Understand context**: Ask the user about their focus areas, team priorities, and the target quarter/year.

2. **Brainstorm goals**: Collaboratively develop 3-5 goals. For each goal, discuss:
   - What does success look like?
   - What are measurable KPIs?
   - What quarter and year does this target?

3. **Create goals**: For each agreed goal, call `rmbr_goal_create` with full enrichment fields (raw_input, title, quarter, year, kpis).

4. **Link existing work**: Check for related items:
   - Call `rmbr_todo_list` to find existing todos that align with each goal
   - Call `rmbr_study_list` to find study topics relevant to each goal
   - Suggest linking these via `rmbr_todo_enrich` (setting goal_id) or `rmbr_study_enrich`

5. **Create action items**: For each goal, suggest initial todos:
   - Call `rmbr_todo_create` with enrichment fields including the goal_id
   - These become the first action items toward each goal

6. **Summary**: Present a summary of all created goals with their KPIs and linked items.

## MCP Tools Used

- `rmbr_goal_create` — Create goals with enrichment
- `rmbr_goal_enrich` — Add details to existing goals
- `rmbr_todo_list` — Find related todos
- `rmbr_todo_create` — Create action items
- `rmbr_todo_enrich` — Link todos to goals
- `rmbr_study_list` — Find related study topics
- `rmbr_study_enrich` — Link study topics to goals
