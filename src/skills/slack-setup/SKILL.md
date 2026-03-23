---
name: slack-setup
description: 'One-time setup guide for configuring the Slack MCP server alongside rmbr. Trigger: setup slack, configure slack mcp, connect slack.'
---

# Slack MCP Setup

Guide the user through configuring the Slack MCP server to work alongside rmbr.

## Workflow

1. **Explain the architecture**: rmbr stores and processes Slack messages locally. The Slack MCP server (korotovsky/slack-mcp-server) connects to the Slack API to fetch messages. Both MCP servers run side by side in Claude Code.

2. **Choose authentication method**:
   - **Browser tokens (recommended for personal use)**: Extract `xoxc` and `xoxd` tokens from the browser. No Slack app installation needed.
     - Open Slack in the browser, open DevTools → Application → Cookies
     - Copy `xoxc-...` token from the `d` cookie
     - Copy `xoxd-...` token from the `d` cookie
   - **OAuth user token**: Create a Slack app with required scopes: `channels:history`, `channels:read`, `users:read`, `search:read`
   - **Bot token**: Limited access (no search, only invited channels)

3. **Configure Claude Code**: Help the user add the Slack MCP server to their Claude Code settings. The configuration goes in `~/.claude/settings.json` or project `.claude/settings.json`:

   ```json
   {
     "mcpServers": {
       "slack": {
         "command": "docker",
         "args": [
           "run",
           "-i",
           "--rm",
           "-e",
           "SLACK_MCP_XOXC_TOKEN",
           "-e",
           "SLACK_MCP_XOXD_TOKEN",
           "ghcr.io/korotovsky/slack-mcp-server:latest"
         ],
         "env": {
           "SLACK_MCP_XOXC_TOKEN": "<user-token-here>",
           "SLACK_MCP_XOXD_TOKEN": "<user-token-here>"
         }
       }
     }
   }
   ```

   Alternative without Docker (requires Go):

   ```json
   {
     "mcpServers": {
       "slack": {
         "command": "go",
         "args": [
           "run",
           "github.com/korotovsky/slack-mcp-server/cmd/slack-mcp-server@latest",
           "--transport",
           "stdio"
         ],
         "env": {
           "SLACK_MCP_XOXC_TOKEN": "<user-token-here>",
           "SLACK_MCP_XOXD_TOKEN": "<user-token-here>"
         }
       }
     }
   }
   ```

4. **Verify setup**: Ask the user to restart Claude Code, then test by calling `channels_list` from the Slack MCP to verify connectivity.

5. **Install rmbr skills**: Suggest running `rmbr skill install` to install all rmbr skills including `slack-ingest` and `slack-process`.

## Notes

- The Slack MCP server is maintained at https://github.com/korotovsky/slack-mcp-server
- Browser tokens provide the most complete access without admin approval
- Sensitive tools (`conversations_add_message`, `conversations_mark`) are disabled by default
