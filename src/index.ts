import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { scrapeEnhancives, getLastUpdated } from './scraper'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

app.use('/*', cors())

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GS4 Enhancive Shopper</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-4xl font-bold mb-8 text-gray-800">GS4 Enhancive Shopper</h1>
    
    <div class="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 class="text-2xl font-semibold mb-4">Search & Filter</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <input type="text" id="searchName" placeholder="Search by name..." class="border p-2 rounded">
        <select id="filterTown" class="border p-2 rounded">
          <option value="">All Towns</option>
        </select>
        <select id="filterWorn" class="border p-2 rounded">
          <option value="">All Slots</option>
        </select>
        <select id="filterStat" class="border p-2 rounded">
          <option value="">All Stats</option>
        </select>
      </div>
    </div>

    <div class="bg-white p-4 rounded-lg shadow-md mb-6">
      <div class="flex justify-between items-center">
        <div>
          <p class="text-gray-600">Total Items in Database: <span id="dbTotal" class="font-bold">0</span></p>
          <p class="text-gray-600">Filtered Results: <span id="totalItems" class="font-bold">0</span></p>
        </div>
        <div class="text-right">
          <p class="text-gray-600 text-sm">Last Updated: <span id="lastUpdated" class="font-semibold">Loading...</span></p>
        </div>
      </div>
    </div>

    <div id="loading" class="text-center py-8">
      <p class="text-xl text-gray-600">Loading items...</p>
    </div>

    <div id="itemsContainer" class="bg-white rounded-lg shadow-md overflow-hidden hidden">
      <table class="min-w-full">
        <thead class="bg-gray-800 text-white">
          <tr>
            <th class="px-4 py-3 text-left">Name</th>
            <th class="px-4 py-3 text-left">Town</th>
            <th class="px-4 py-3 text-left">Shop</th>
            <th class="px-4 py-3 text-right">Cost</th>
            <th class="px-4 py-3 text-left">Slot</th>
            <th class="px-4 py-3 text-left">Enhancives</th>
          </tr>
        </thead>
        <tbody id="itemsTable" class="divide-y divide-gray-200">
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const API_BASE = window.location.origin
    let allItems = []
    let filteredItems = []

    async function loadItems() {
      try {
        const response = await fetch(API_BASE + '/api/items')
        const data = await response.json()
        allItems = data.items || []
        
        document.getElementById('dbTotal').textContent = data.total || allItems.length
        document.getElementById('lastUpdated').textContent = data.lastUpdated || 'Never'
        
        populateFilters()
        filterItems()
        
        document.getElementById('loading').classList.add('hidden')
        document.getElementById('itemsContainer').classList.remove('hidden')
      } catch (error) {
        console.error('Error loading items:', error)
        document.getElementById('loading').innerHTML = '<p class="text-red-600">Error loading items</p>'
      }
    }

    function populateFilters() {
      const towns = [...new Set(allItems.map(item => item.town))].sort()
      const worn = [...new Set(allItems.map(item => item.worn).filter(Boolean))].sort()
      const stats = [...new Set(allItems.flatMap(item => {
        try {
          return JSON.parse(item.enhancives_json).map(e => e.ability)
        } catch {
          return []
        }
      }))].sort()

      const townSelect = document.getElementById('filterTown')
      towns.forEach(town => {
        const option = document.createElement('option')
        option.value = town
        option.textContent = town
        townSelect.appendChild(option)
      })

      const wornSelect = document.getElementById('filterWorn')
      worn.forEach(slot => {
        const option = document.createElement('option')
        option.value = slot
        option.textContent = slot
        wornSelect.appendChild(option)
      })

      const statSelect = document.getElementById('filterStat')
      stats.forEach(stat => {
        const option = document.createElement('option')
        option.value = stat
        option.textContent = stat
        statSelect.appendChild(option)
      })
    }

    function filterItems() {
      const searchName = document.getElementById('searchName').value.toLowerCase()
      const filterTown = document.getElementById('filterTown').value
      const filterWorn = document.getElementById('filterWorn').value
      const filterStat = document.getElementById('filterStat').value

      filteredItems = allItems.filter(item => {
        if (searchName && !item.name.toLowerCase().includes(searchName)) return false
        if (filterTown && item.town !== filterTown) return false
        if (filterWorn && item.worn !== filterWorn) return false
        if (filterStat) {
          try {
            const enhancives = JSON.parse(item.enhancives_json)
            if (!enhancives.some(e => e.ability === filterStat)) return false
          } catch {
            return false
          }
        }
        return true
      })

      renderItems()
    }

    function renderItems() {
      const tbody = document.getElementById('itemsTable')
      tbody.innerHTML = ''

      document.getElementById('totalItems').textContent = filteredItems.length

      filteredItems.slice(0, 500).forEach(item => {
        const tr = document.createElement('tr')
        tr.className = 'hover:bg-gray-50'

        let enhancivesText = ''
        try {
          const enhancives = JSON.parse(item.enhancives_json)
          enhancivesText = enhancives.map(e => \`+\${e.boost} \${e.ability}\`).join(', ')
        } catch {
          enhancivesText = 'Error parsing'
        }

        tr.innerHTML = \`
          <td class="px-4 py-3">\${item.name}</td>
          <td class="px-4 py-3">\${item.town}</td>
          <td class="px-4 py-3">\${item.shop}</td>
          <td class="px-4 py-3 text-right">\${item.cost ? item.cost.toLocaleString() : 'N/A'}</td>
          <td class="px-4 py-3">\${item.worn || 'N/A'}</td>
          <td class="px-4 py-3 text-sm">\${enhancivesText}</td>
        \`
        tbody.appendChild(tr)
      })

      if (filteredItems.length > 500) {
        const tr = document.createElement('tr')
        tr.innerHTML = \`<td colspan="6" class="px-4 py-3 text-center text-gray-500">Showing first 500 of \${filteredItems.length} items</td>\`
        tbody.appendChild(tr)
      }
    }

    document.getElementById('searchName').addEventListener('input', filterItems)
    document.getElementById('filterTown').addEventListener('change', filterItems)
    document.getElementById('filterWorn').addEventListener('change', filterItems)
    document.getElementById('filterStat').addEventListener('change', filterItems)

    loadItems()
  </script>
</body>
</html>`)
})

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.get('/api/items', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM shop_items ORDER BY scraped_at DESC').all()
  const { results: metadata } = await c.env.DB.prepare('SELECT * FROM metadata').all()
  const lastUpdated = metadata.find((m: any) => m.key === 'last_updated')?.value
  
  return c.json({ 
    items: results,
    total: results.length,
    lastUpdated: lastUpdated || null
  })
})

app.post('/api/scrape', async (c) => {
  try {
    const items = await scrapeEnhancives()
    
    // Batch insert for better performance
    const stmt = c.env.DB.prepare(
      `INSERT OR REPLACE INTO shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    
    const batch = items.map(item => 
      stmt.bind(
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
    )
    
    await c.env.DB.batch(batch)

    return c.json({ success: true, count: items.length })
  } catch (error) {
    console.error('Scrape error:', error)
    return c.json({ error: String(error) }, 500)
  }
})

export default {
  fetch: app.fetch,
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    try {
      const lastUpdated = await getLastUpdated()
      if (!lastUpdated) return

      const { results } = await env.DB.prepare('SELECT value FROM metadata WHERE key = ?')
        .bind('last_updated')
        .all()

      const stored = results[0]?.value as string | undefined

      if (stored !== lastUpdated) {
        console.log('Update detected, scraping...')
        const items = await scrapeEnhancives()

        const stmt = env.DB.prepare(
          `INSERT OR REPLACE INTO shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        
        const batch = items.map(item => 
          stmt.bind(
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
        )
        
        await env.DB.batch(batch)

        await env.DB.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)')
          .bind('last_updated', lastUpdated)
          .run()

        console.log(`Scraped ${items.length} items`)
      }
    } catch (error) {
      console.error('Scheduled scrape error:', error)
    }
  },
}
