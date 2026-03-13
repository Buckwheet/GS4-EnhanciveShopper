// Migration script to move data from old schema to new schema
// Old: user_goals, user_inventory, character_sets
// New: characters -> sets -> set_goals, set_inventory

export async function migrateToNewSchema(DB: any): Promise<{ success: boolean; message: string; stats: any }> {
  const stats = {
    charactersCreated: 0,
    setsCreated: 0,
    goalsMigrated: 0,
    inventoryMigrated: 0,
    errors: [] as string[]
  }

  try {
    // Step 1: Get all unique discord_id + goal_set_name combinations from user_goals
    const { results: oldGoalSets } = await DB.prepare(`
      SELECT DISTINCT discord_id, goal_set_name, account_type, base_stats, skill_ranks, MIN(created_at) as created_at
      FROM user_goals
      WHERE goal_set_name IS NOT NULL
      GROUP BY discord_id, goal_set_name
    `).all()

    for (const oldSet of oldGoalSets) {
      const characterName = oldSet.goal_set_name
      const discordId = oldSet.discord_id

      // Create character if doesn't exist
      await DB.prepare(`
        INSERT INTO characters (discord_id, character_name, base_stats, skill_ranks, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(discord_id, character_name) DO NOTHING
      `).bind(discordId, characterName, oldSet.base_stats, oldSet.skill_ranks, oldSet.created_at).run()
      
      const charResult = await DB.prepare('SELECT id FROM characters WHERE discord_id = ? AND character_name = ?')
        .bind(discordId, characterName).first()
      
      if (!charResult) continue
      stats.charactersCreated++

      // Create set (using same name as character for now)
      await DB.prepare(`
        INSERT INTO sets (character_id, set_name, account_type, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(character_id, set_name) DO NOTHING
      `).bind(charResult.id, characterName, oldSet.account_type || 'F2P', oldSet.created_at).run()
      
      const setResult = await DB.prepare('SELECT id FROM sets WHERE character_id = ? AND set_name = ?')
        .bind(charResult.id, characterName).first()
      
      if (!setResult) continue
      stats.setsCreated++

      // Migrate goals
      const { results: oldGoals } = await DB.prepare(`
        SELECT stat, min_boost, max_cost, preferred_slots, created_at
        FROM user_goals
        WHERE discord_id = ? AND goal_set_name = ? AND stat != '_placeholder'
      `).bind(discordId, oldSet.goal_set_name).all()

      for (const goal of oldGoals) {
        await DB.prepare(`
          INSERT INTO set_goals (set_id, stat, min_boost, max_cost, preferred_slots, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT DO NOTHING
        `).bind(setResult.id, goal.stat, goal.min_boost, goal.max_cost, goal.preferred_slots, goal.created_at).run()
        stats.goalsMigrated++
      }

      // Migrate inventory
      const { results: oldInventory } = await DB.prepare(`
        SELECT item_name, slot, enhancives_json, is_permanent, is_irreplaceable, created_at
        FROM user_inventory
        WHERE discord_id = ? AND goal_set_name = ?
      `).bind(discordId, oldSet.goal_set_name).all()

      for (const item of oldInventory) {
        await DB.prepare(`
          INSERT INTO set_inventory (set_id, item_name, slot, enhancives_json, is_permanent, is_irreplaceable, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT DO NOTHING
        `).bind(setResult.id, item.item_name, item.slot, item.enhancives_json, item.is_permanent || 0, item.is_irreplaceable || 0, item.created_at).run()
        stats.inventoryMigrated++
      }
    }

    return {
      success: true,
      message: 'Migration completed successfully',
      stats
    }
  } catch (error: any) {
    stats.errors.push(error.message)
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      stats
    }
  }
}
