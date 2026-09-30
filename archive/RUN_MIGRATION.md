# Run Schema Migration

## From Windows Command Prompt or PowerShell:

```bash
cd C:\Users\rpgfi\enhancive-alert
npx wrangler d1 execute enhancive-db --file=schema.sql --remote
```

This will:
1. Create new tables (character_sets, set_inventory, set_goals)
2. Migrate all existing data from user_goals and user_inventory
3. Keep old tables intact (for safety)

After running, confirm success and we'll update the code to use the new schema.
