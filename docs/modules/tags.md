# Tags

Cross-entity labeling system. Any entity from any module can be tagged, enabling flexible organization and querying across the entire second brain.

## Supported Entity Types

Tags can be applied to entities from any module:

- `todo`
- `kudos`
- `goal`
- `til`
- `study`
- `slack`

## Tag Entity

| Field      | Type     | Description        |
| ---------- | -------- | ------------------ |
| id         | `TagId`  | Branded numeric ID |
| name       | `string` | Tag name (unique)  |
| created_at | `string` | ISO timestamp      |

## Entity Tag (Junction)

The junction table links tags to entities across all modules.

| Field       | Type         | Description                |
| ----------- | ------------ | -------------------------- |
| id          | `number`     | Junction record ID         |
| tag_id      | `number`     | References the tag         |
| entity_type | `EntityType` | One of the supported types |
| entity_id   | `number`     | ID of the tagged entity    |
| created_at  | `string`     | ISO timestamp              |

## Interactive TUI

`rmbr tag list` opens an interactive two-panel terminal UI:

- **Tag list panel:** Arrow keys to navigate tags, `Enter` to drill into a tag's entities
- **Entity list panel:** Arrow keys to navigate entities, `t` to cycle entity type filter, `Esc` to go back
- Color-coded entity types: todo (blue), goal (green), kudos (magenta), til (cyan), study (yellow), slack (gray)
- `q` to quit from either panel
- Use `--ai` for plain text output (for AI agents or scripts)

## CLI Commands

For full syntax details, see the [CLI Reference](/guide/cli-usage).

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `rmbr tag add`      | Tag an entity (creates the tag if needed)        |
| `rmbr tag remove`   | Remove a tag from an entity                      |
| `rmbr tag list`     | Interactive TUI (default) or plain text (`--ai`) |
| `rmbr tag entities` | List all entities with a given tag               |
| `rmbr tag show`     | Show all tags for a specific entity              |

## MCP Tools

| Tool                    | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `rmbr_tag_entity`       | Tag an entity; creates the tag if it doesn't exist |
| `rmbr_untag_entity`     | Remove a tag from an entity                        |
| `rmbr_tag_list`         | List all tags                                      |
| `rmbr_tag_get_entities` | Get all entities associated with a tag             |
| `rmbr_entity_tags`      | Get all tags for a specific entity                 |

## Usage Examples

Tag a todo, then query all entities sharing that tag:

```sh
# Tag a todo with "sprint-12"
rmbr tag add sprint-12 todo 42

# List all entities tagged "sprint-12"
rmbr tag entities sprint-12
```

This works across entity types, so goals, kudos, and TILs tagged with the same label all appear together:

```sh
# Tag a goal with the same label
rmbr tag add sprint-12 goal 7

# Both the todo and the goal now appear
rmbr tag entities sprint-12
```
