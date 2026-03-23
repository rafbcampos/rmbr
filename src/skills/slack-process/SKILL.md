---
name: slack-process
description: 'Intelligently process unread Slack messages — analyze sentiment, extract action items, create todos and kudos, link to goals, and surface trends. Trigger: process slack, slack triage, inbox zero slack.'
---

# Slack Message Processing

Triage unprocessed Slack messages by analyzing sentiment, extracting action items, recognizing kudos, and linking to goals.

## Workflow

1. **Fetch unprocessed messages**: Call `rmbr_slack_list` with `processed: 0` to get all unprocessed messages.

2. **Load context**: Call `rmbr_goal_list` with `status: active` to have active goals available for linking.

3. **For each message**, analyze and take action:

   a. **Sentiment analysis**: Determine if the message is positive, negative, or neutral based on content. Call `rmbr_slack_set_sentiment` with the determined sentiment.

   b. **Action item extraction**: Identify any action items, requests, or commitments in the message. For each action item:
   - Search for existing todos with similar titles using `rmbr_search` to avoid duplicates
   - If no match, call `rmbr_todo_create` with enrichment fields (title, priority, due_date if mentioned)
   - Call `rmbr_slack_link_todo` to link the message to the created or matched todo

   c. **Kudos recognition**: If the message contains praise, recognition, or thanks directed at the user or from the user about someone:
   - Call `rmbr_kudos_create` with direction (given/received), person, summary, and context
   - This captures recognition that might otherwise be lost in chat history

   d. **Goal linkage**: If the message relates to an existing active goal, call `rmbr_slack_link_goal` to associate them.

   e. **Mark processed**: Call `rmbr_slack_mark_processed` once the message has been fully triaged.

4. **Sentiment trends**: After processing, analyze the overall sentiment distribution:
   - Call `rmbr_slack_list` with each sentiment value to get counts
   - Flag concerning patterns (e.g., "5 negative messages this week from #team-backend — might be worth checking in")
   - Highlight positive trends (e.g., "Strong positive sentiment from #product — team morale looks good")

5. **Summary**: Present a summary of processing results:
   - Messages processed count
   - Sentiment breakdown (positive/negative/neutral) with trend analysis
   - Todos created and linked
   - Kudos captured
   - Goal linkages made

## MCP Tools Used

- `rmbr_slack_list` — Get unprocessed messages and sentiment counts
- `rmbr_slack_set_sentiment` — Classify message sentiment
- `rmbr_slack_link_todo` — Link message to a todo
- `rmbr_slack_link_goal` — Link message to a goal
- `rmbr_slack_mark_processed` — Mark message as handled
- `rmbr_todo_create` — Create action item todos
- `rmbr_kudos_create` — Capture recognition and praise
- `rmbr_goal_list` — Find active goals to link
- `rmbr_search` — Find existing todos to avoid duplicates
