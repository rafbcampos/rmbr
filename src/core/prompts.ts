export const ENRICHMENT_PROMPTS = {
  goals: `When creating or enriching a goal, follow the STAR framework guidance:
- title: Extract a clear, concise goal title (5-10 words)
- quarter: Assign to the most relevant quarter (Q1, Q2, Q3, Q4)
- year: Assign the calendar year
- kpis: Define 2-4 measurable KPIs as a JSON array of strings, each with a specific metric and target (e.g. ["Reduce deploy time by 50%", "Achieve 95% test coverage"])
Always provide all enrichment fields when creating — produce a fully enriched entity, never a draft.`,

  todo: `When creating or enriching a todo, extract structured data from the input:
- title: A clear, actionable title (start with a verb)
- priority: One of "low", "medium", "high", "critical" based on urgency/impact
- due_date: Parse any date references into ISO format (YYYY-MM-DD)
- goal_id: If the todo relates to an existing goal, link it by ID
Always provide all enrichment fields when creating — produce a fully enriched entity, never a sketch.`,

  kudos: `When creating or enriching a kudos entry, extract:
- direction: "given" if the user gave kudos to someone, "received" if someone gave kudos to the user
- person: The full name of the person involved
- summary: A one-sentence summary of what the kudos was for
- context: The situation or project context
- goal_id: If this kudos relates to an existing goal, link it by ID
Always provide all enrichment fields when creating — produce a fully enriched entity.`,

  til: `When creating or enriching a TIL (Today I Learned) entry, extract:
- title: A concise, descriptive title for the learning
- content: A structured explanation of what was learned, formatted for future reference
- domain: A lowercase classification tag (e.g. "typescript", "architecture", "devops")
- tags: A JSON array of relevant keyword tags (e.g. ["generics", "type-safety"])
Always provide all enrichment fields when creating — produce a fully enriched entity.`,

  study: `When creating or enriching a study topic, extract:
- title: A clear topic title for the area of study
- domain: A lowercase domain classification (e.g. "programming", "mathematics", "design")
- goal_id: If this study topic supports an existing goal, link it by ID
Always provide all enrichment fields when creating — produce a fully enriched entity.`,

  slack: `When ingesting a Slack message, analyze and extract:
- Determine the sentiment: "positive", "negative", or "neutral"
- Identify any action items that should become todos (use rmbr_todo_create)
- Determine if the message relates to existing goals or todos and link them
- Mark the message as processed after enrichment`,
} as const;
