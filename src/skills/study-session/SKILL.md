---
name: study-session
description: 'Interactive study session — pick the next topic, guide learning, capture notes and resources, create TIL entries. Trigger: study, learning session, what should I study, study next.'
---

# Study Session

Guide the user through a focused study session with structured note-taking and knowledge capture.

## Workflow

1. **Pick a topic**: Call `rmbr_study_next` to get the next queued study topic. If none queued, call `rmbr_study_list` with status `in_progress` to find an active topic. Present the topic to the user.

2. **Start the session**: If the topic is queued, call `rmbr_study_transition` to move it to `in_progress`.

3. **Guide study**: Have a conversation with the user about the topic. As they learn:
   - Ask what they're discovering
   - Suggest areas to explore
   - Help them think through concepts

4. **Capture notes**: As the user shares insights, call `rmbr_study_add_note` to record key takeaways.

5. **Add resources**: When the user mentions useful links, articles, or references, call `rmbr_study_add_resource` to save them.

6. **Create TIL entries**: For discrete, standalone learnings that emerged during the session, call `rmbr_til_create` with enrichment fields (title, content, domain).

7. **Wrap up**: When the session is done, ask if the topic is complete:
   - If yes: call `rmbr_study_transition` to `completed`
   - If more to learn: leave as `in_progress`
   - If parking for later: call `rmbr_study_transition` to `parked`

8. **Summary**: Present a session summary — notes added, resources saved, TILs created.

## MCP Tools Used

- `rmbr_study_next` — Get next queued topic
- `rmbr_study_list` — List topics by status
- `rmbr_study_transition` — Move topic through statuses
- `rmbr_study_add_note` — Capture study notes
- `rmbr_study_add_resource` — Save reference URLs
- `rmbr_til_create` — Record standalone learnings
