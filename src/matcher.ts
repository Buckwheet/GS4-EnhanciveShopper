import type { Env } from './types'
import { sendDiscordDM, formatItemAlert } from './discord'

export async function checkMatches(env: Env, newItems: any[]) {
  const { results: goals } = await env.DB.prepare('SELECT * FROM set_goals WHERE set_id IS NOT NULL').all()
  console.log(`Checking ${newItems.length} items against ${goals.length} goals`)

  for (const goal of goals) {
    const set = await env.DB.prepare(
      'SELECT character_id FROM sets WHERE id = ?'
    ).bind(goal.set_id).first()
    
    if (!set) continue

    const character = await env.DB.prepare(
      'SELECT discord_id FROM characters WHERE id = ?'
    ).bind(set.character_id).first()
    
    if (!character) continue

    const matchingItems = newItems.filter(item => {
      try {
        const enhancives = JSON.parse(item.enhancives_json)
        
        const hasMatch = enhancives.some((enh: any) => 
          enh.ability.toLowerCase().includes((goal.stat as string).toLowerCase()) && enh.boost >= Number(goal.min_boost)
        )
        
        if (!hasMatch) return false

        if (goal.max_cost && item.cost > Number(goal.max_cost)) return false

        if (goal.preferred_slots) {
          const slots = (goal.preferred_slots as string).split(',').map((s: string) => s.trim())
          const itemSlot = item.worn || 'nugget'
          const matchesSlot = slots.some((slot: string) => {
            if (slot === 'nugget') {
              return !item.worn || item.worn === 'N/A'
            }
            return slot === itemSlot
          })
          if (!matchesSlot) return false
        }

        return true
      } catch {
        return false
      }
    })

    console.log(`Goal "${goal.stat}" +${goal.min_boost}: Found ${matchingItems.length} matches`)

    for (const item of matchingItems) {
      const { results: existing } = await env.DB.prepare(
        'SELECT id FROM alerts WHERE discord_id = ? AND item_id = ?'
      ).bind(character.discord_id as string, item.id).all()

      if (existing.length === 0) {
        const user = await env.DB.prepare('SELECT notifications_enabled FROM users WHERE discord_id = ?').bind(character.discord_id).first()
        const notificationsEnabled = user?.notifications_enabled === 1
        
        let sent = false
        if (notificationsEnabled) {
          console.log(`Sending alert for item ${item.id} to ${character.discord_id}`)
          const message = formatItemAlert(item)
          sent = await sendDiscordDM(env.DISCORD_BOT_TOKEN, character.discord_id as string, message)
          console.log(`Alert sent: ${sent}`)
        } else {
          console.log(`Skipping Discord DM for ${character.discord_id} - notifications disabled`)
        }

        await env.DB.prepare(
          'INSERT INTO alerts (discord_id, item_id, goal_id, sent_at, delivered) VALUES (?, ?, ?, ?, ?)'
        ).bind(character.discord_id, item.id, goal.id, new Date().toISOString(), sent ? 1 : 0).run()
      } else {
        console.log(`Already alerted for item ${item.id}`)
      }
    }
  }
}
