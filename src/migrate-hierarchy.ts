import type { Context } from 'hono'
import type { Env } from './types'

export async function migrateToHierarchy(c: Context<{ Bindings: Env }>) {
  const db = c.env.DB

  try {
    // Create characters table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL,
        character_name TEXT NOT NULL,
        base_stats TEXT,
        skill_ranks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(discord_id, character_name)
      )
    `).run()

    // Create sets table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        set_name TEXT NOT NULL,
        account_type TEXT DEFAULT 'F2P',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        UNIQUE(character_id, set_name)
      )
    `).run()

    // Migrate: Extract characters from character_sets
    await db.prepare(`
      INSERT INTO characters (discord_id, character_name, base_stats, skill_ranks, created_at)
      SELECT 
        discord_id,
        set_name as character_name,
        base_stats,
        skill_ranks,
        created_at
      FROM character_sets
      WHERE true
      ON CONFLICT(discord_id, character_name) DO NOTHING
    `).run()

    // Migrate: Create default sets for each character
    await db.prepare(`
      INSERT INTO sets (character_id, set_name, account_type, created_at)
      SELECT 
        c.id as character_id,
        'Default' as set_name,
        cs.account_type,
        cs.created_at
      FROM character_sets cs
      JOIN characters c ON c.discord_id = cs.discord_id AND c.character_name = cs.set_name
    `).run()

    // Add set_id column to set_goals
    await db.prepare(`ALTER TABLE set_goals ADD COLUMN set_id INTEGER`).run()

    // Populate set_id in set_goals
    await db.prepare(`
      UPDATE set_goals
      SET set_id = (
        SELECT s.id
        FROM sets s
        JOIN characters c ON s.character_id = c.id
        JOIN character_sets cs ON cs.discord_id = c.discord_id AND cs.set_name = c.character_name
        WHERE set_goals.character_set_id = cs.id
      )
    `).run()

    // Add set_id column to set_inventory
    await db.prepare(`ALTER TABLE set_inventory ADD COLUMN set_id INTEGER`).run()

    // Populate set_id in set_inventory
    await db.prepare(`
      UPDATE set_inventory
      SET set_id = (
        SELECT s.id
        FROM sets s
        JOIN characters c ON s.character_id = c.id
        JOIN character_sets cs ON cs.discord_id = c.discord_id AND cs.set_name = c.character_name
        WHERE set_inventory.character_set_id = cs.id
      )
    `).run()

    return c.json({ success: true, message: 'Hierarchy migration completed' })
  } catch (error: any) {
    console.error('Migration error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
}
