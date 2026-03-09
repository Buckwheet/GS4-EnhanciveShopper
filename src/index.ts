import { Hono } from 'hono'
import { scrapeEnhancives, getLastUpdated } from './scraper'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.json({ message: 'GS4 Enhancive Shopper API' }))

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.get('/api/items', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM shop_items ORDER BY scraped_at DESC LIMIT 100').all()
  return c.json({ items: results })
})

app.post('/api/scrape', async (c) => {
  const items = await scrapeEnhancives()
  
  for (const item of items) {
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        item.id,
        item.name,
        item.town,
        item.shop,
        item.cost,
        item.enchant,
        item.worn,
        JSON.stringify(item.enhancives),
        new Date().toISOString()
      )
      .run()
  }

  return c.json({ success: true, count: items.length })
})

export default {
  fetch: app.fetch,
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const lastUpdated = await getLastUpdated()
    if (!lastUpdated) return

    const { results } = await env.DB.prepare('SELECT value FROM metadata WHERE key = ?')
      .bind('last_updated')
      .all()

    const stored = results[0]?.value as string | undefined

    if (stored !== lastUpdated) {
      console.log('Update detected, scraping...')
      const items = await scrapeEnhancives()

      for (const item of items) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            item.id,
            item.name,
            item.town,
            item.shop,
            item.cost,
            item.enchant,
            item.worn,
            JSON.stringify(item.enhancives),
            new Date().toISOString()
          )
          .run()
      }

      await env.DB.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)')
        .bind('last_updated', lastUpdated)
        .run()

      console.log(`Scraped ${items.length} items`)
    }
  },
}
