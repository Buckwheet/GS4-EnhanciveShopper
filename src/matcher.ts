import type { Env } from './types'
import { sendDiscordDM, formatItemAlert } from './discord'

const DEDUP_IN_CHUNK = 90 // D1 limit: 100 bound params per query

export async function checkMatches(env: Env, newItems: any[]) {
  // Resolve goal -> set -> character -> discord_id in ONE set-based query,
  // eliminating the previous per-goal round-trips (2 queries per goal).
  const { results: rows } = await env.DB.prepare(
    `SELECT
        g.id AS goal_id,
        g.stat,
        g.min_boost,
        g.max_cost,
        g.preferred_slots,
        g.set_id,
        c.discord_id
     FROM set_goals g
     JOIN sets s ON s.id = g.set_id
     JOIN characters c ON c.id = s.character_id
     WHERE g.set_id IS NOT NULL`
  ).all()
  const goals = rows as any[]

  console.log(`Checking ${newItems.length} items against ${goals.length} goals`)

  for (const goal of goals) {
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

    // Batch the per-item dedup check: which of these matching items were already alerted for this user.
    const existingIds = new Set<number>()
    for (let i = 0; i < matchingItems.length; i += DEDUP_IN_CHUNK) {
      const chunk = matchingItems.slice(i, i + DEDUP_IN_CHUNK)
      const placeholders = chunk.map(() => '?').join(',')
      const { results: existing } = await env.DB.prepare(
        `SELECT item_id FROM alerts WHERE discord_id = ? AND item_id IN (${placeholders})`
      ).bind(goal.discord_id, ...chunk.map((it: any) => it.id)).all()
      for (const row of (existing as any[])) existingIds.add(row.item_id)
    }

    for (const item of matchingItems) {
      if (existingIds.has(item.id)) {
        console.log(`Already alerted for item ${item.id}`)
        continue
      }

      const user = await env.DB.prepare('SELECT notifications_enabled FROM users WHERE discord_id = ?').bind(goal.discord_id).first()
      const notificationsEnabled = user?.notifications_enabled === 1

      let sent = false
      if (notificationsEnabled) {
        console.log(`Sending alert for item ${item.id} to ${goal.discord_id}`)
        const message = formatItemAlert(item)
        sent = await sendDiscordDM(env.DISCORD_BOT_TOKEN, goal.discord_id as string, message)
        console.log(`Alert sent: ${sent}`)
      } else {
        console.log(`Skipping Discord DM for ${goal.discord_id} - notifications disabled`)
      }

      await env.DB.prepare(
        'INSERT INTO alerts (discord_id, item_id, goal_id, sent_at, delivered) VALUES (?, ?, ?, ?, ?)'
      ).bind(goal.discord_id, item.id, goal.goal_id, new Date().toISOString(), sent ? 1 : 0).run()
    }
  }
}
