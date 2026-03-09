import type { Env } from './types'
import { sendDiscordDM, formatItemAlert } from './discord'

export async function checkMatches(env: Env, newItems: any[]) {
  const { results: goals } = await env.DB.prepare('SELECT * FROM user_goals').all()
  console.log(`Checking ${newItems.length} items against ${goals.length} goals`)

  for (const goal of goals) {
    const matchingItems = newItems.filter(item => {
      try {
        const enhancives = JSON.parse(item.enhancives_json)
        
        // Check if any enhancive matches the stat and boost requirement
        // Use case-insensitive partial matching (e.g., "strength" matches "Strength Base")
        const hasMatch = enhancives.some((enh: any) => 
          enh.ability.toLowerCase().includes(goal.stat.toLowerCase()) && enh.boost >= goal.min_boost
        )
        
        if (!hasMatch) return false

        // Check cost constraint
        if (goal.max_cost && item.cost > goal.max_cost) return false

        // Check slot preference
        if (goal.preferred_slots) {
          const slots = goal.preferred_slots.split(',').map((s: string) => s.trim())
          if (!slots.includes(item.worn)) return false
        }

        return true
      } catch {
        return false
      }
    })

    console.log(`Goal "${goal.stat}" +${goal.min_boost}: Found ${matchingItems.length} matches`)

    // Send alerts for matches
    for (const item of matchingItems) {
      // Check if already alerted
      const { results: existing } = await env.DB.prepare(
        'SELECT id FROM alerts WHERE discord_id = ? AND item_id = ?'
      ).bind(goal.discord_id, item.id).all()

      if (existing.length === 0) {
        console.log(`Sending alert for item ${item.id} to ${goal.discord_id}`)
        const message = formatItemAlert(item)
        const sent = await sendDiscordDM(env.DISCORD_BOT_TOKEN, goal.discord_id, message)
        console.log(`Alert sent: ${sent}`)

        await env.DB.prepare(
          'INSERT INTO alerts (discord_id, item_id, goal_id, sent_at, delivered) VALUES (?, ?, ?, ?, ?)'
        ).bind(goal.discord_id, item.id, goal.id, new Date().toISOString(), sent ? 1 : 0).run()
      } else {
        console.log(`Already alerted for item ${item.id}`)
      }
    }
  }
}
