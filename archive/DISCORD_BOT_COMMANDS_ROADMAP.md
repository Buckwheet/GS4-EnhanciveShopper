# Discord Bot Command System Roadmap

## Overview
Transform the bot from outbound-only DMs into a full interactive command system using Discord Interactions (webhook-based, compatible with Cloudflare Workers).

## Setup Required
1. Register Interactions Endpoint URL in Discord Developer Portal → General Information → `https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/discord-interactions`
2. Register slash commands via Discord API
3. Handle interaction webhook + signature verification in Worker

## Commands

### Inventory Management
- `/import` — Paste YAML from Lich script, bot parses and imports it
- `/inventory [character]` — Show current equipped items
- `/equip [item]` — Manually add an item to inventory
- `/unequip [slot]` — Remove item from slot

### Goals
- `/goal add [stat] [amount]` — e.g., `/goal add Strength 20`
- `/goal list` — Show current goals
- `/goal remove [stat]` — Remove a goal

### Search & Browse
- `/search [stat] [min_boost]` — Find items in shops matching criteria
- `/recommend [character] [set]` — Get AI recommendations
- `/price [item_name]` — Check current shop prices

### Alerts
- `/alerts on/off` — Toggle DM notifications
- `/alerts status` — Show what you're watching for

### Characters & Sets
- `/characters` — List your characters
- `/sets [character]` — List sets for a character
- `/set use [character] [set]` — Switch active set

## Implementation Order
1. Interaction endpoint + signature verification (plumbing)
2. `/search` — Most immediately useful, read-only
3. `/recommend` — Leverages existing recommendation engine
4. `/import` — Paste YAML directly to bot
5. Goal management commands
6. Inventory management commands
7. Alert controls
8. Character/set management

## Technical Notes
- Discord Interactions are webhook-based (POST to Worker) — no WebSocket/Gateway needed
- All requests must have signature verification (Discord requirement)
- Responses can be immediate (<3s) or deferred (for longer operations like /recommend)
- Rich embeds for formatted item/recommendation display
