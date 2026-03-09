import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { scrapeEnhancives, getLastUpdated } from './scraper'
import { checkMatches } from './matcher'
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
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-4xl font-bold text-gray-800">GS4 Enhancive Shopper</h1>
      <div id="authSection">
        <button id="loginBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-semibold">
          Login with Discord
        </button>
        <div id="userInfo" class="hidden">
          <span class="text-gray-700">Welcome, <span id="username" class="font-bold"></span>!</span>
          <button id="logoutBtn" class="ml-4 text-sm text-gray-600 hover:text-gray-800">Logout</button>
        </div>
      </div>
    </div>
    
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

    <!-- Goals Section (only visible when logged in) -->
    <div id="goalsSection" class="hidden mb-6">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h2 class="text-2xl font-semibold mb-4">My Alert Goals</h2>
        
        <div class="mb-4">
          <button id="addGoalBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
            + Add New Goal
          </button>
        </div>

        <div id="addGoalForm" class="hidden mb-4 p-4 border rounded bg-gray-50">
          <h3 class="font-semibold mb-3">Create Alert Goal</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" id="goalStat" placeholder="Stat (e.g., Strength)" class="border p-2 rounded">
            <input type="number" id="goalBoost" placeholder="Min Boost (e.g., 5)" class="border p-2 rounded">
            <input type="number" id="goalMaxCost" placeholder="Max Cost (optional)" class="border p-2 rounded">
            <input type="text" id="goalSlots" placeholder="Preferred Slots (comma-separated, optional)" class="border p-2 rounded">
          </div>
          <div class="mt-3 flex gap-2">
            <button id="saveGoalBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Save</button>
            <button id="cancelGoalBtn" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Cancel</button>
          </div>
        </div>

        <div id="goalsList" class="space-y-2">
          <p class="text-gray-500">No goals yet. Add one to get started!</p>
        </div>
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
    let currentUser = null

    // Auth handling
    function initAuth() {
      const stored = localStorage.getItem('discord_user')
      if (stored) {
        currentUser = JSON.parse(stored)
        showUserInfo()
      }
    }

    function showUserInfo() {
      document.getElementById('loginBtn').classList.add('hidden')
      document.getElementById('userInfo').classList.remove('hidden')
      document.getElementById('username').textContent = currentUser.username
      document.getElementById('goalsSection').classList.remove('hidden')
      loadGoals()
    }

    function hideUserInfo() {
      document.getElementById('loginBtn').classList.remove('hidden')
      document.getElementById('userInfo').classList.add('hidden')
      document.getElementById('goalsSection').classList.add('hidden')
    }

    document.getElementById('loginBtn').addEventListener('click', () => {
      const width = 500
      const height = 700
      const left = (screen.width - width) / 2
      const top = (screen.height - height) / 2
      window.open(
        API_BASE + '/api/auth/discord',
        'Discord Login',
        \`width=\${width},height=\${height},left=\${left},top=\${top}\`
      )
    })

    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('discord_user')
      currentUser = null
      hideUserInfo()
    })

    window.addEventListener('message', (event) => {
      if (event.data.type === 'discord_auth') {
        currentUser = event.data.user
        localStorage.setItem('discord_user', JSON.stringify(currentUser))
        showUserInfo()
      }
    })

    // Goals management
    async function loadGoals() {
      if (!currentUser) return
      
      const response = await fetch(API_BASE + '/api/goals?discord_id=' + currentUser.id)
      const data = await response.json()
      
      const goalsList = document.getElementById('goalsList')
      if (data.goals.length === 0) {
        goalsList.innerHTML = '<p class="text-gray-500">No goals yet. Add one to get started!</p>'
        return
      }

      goalsList.innerHTML = data.goals.map(goal => \`
        <div class="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
          <div>
            <span class="font-semibold">\${goal.stat}</span> 
            <span class="text-gray-600">+\${goal.min_boost} or higher</span>
            \${goal.max_cost ? \`<span class="text-sm text-gray-500">• Max: \${goal.max_cost.toLocaleString()}</span>\` : ''}
            \${goal.preferred_slots ? \`<span class="text-sm text-gray-500">• Slots: \${goal.preferred_slots}</span>\` : ''}
          </div>
          <button class="text-red-600 hover:text-red-800" onclick="deleteGoal(\${goal.id})">Delete</button>
        </div>
      \`).join('')
    }

    window.deleteGoal = async function(id) {
      if (!confirm('Delete this goal?')) return
      await fetch(API_BASE + '/api/goals/' + id, { method: 'DELETE' })
      loadGoals()
    }

    document.getElementById('addGoalBtn').addEventListener('click', () => {
      document.getElementById('addGoalForm').classList.remove('hidden')
    })

    document.getElementById('cancelGoalBtn').addEventListener('click', () => {
      document.getElementById('addGoalForm').classList.add('hidden')
    })

    document.getElementById('saveGoalBtn').addEventListener('click', async () => {
      const stat = document.getElementById('goalStat').value
      const boost = document.getElementById('goalBoost').value
      const maxCost = document.getElementById('goalMaxCost').value
      const slots = document.getElementById('goalSlots').value

      if (!stat || !boost) {
        alert('Stat and Min Boost are required')
        return
      }

      await fetch(API_BASE + '/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_id: currentUser.id,
          stat,
          min_boost: parseInt(boost),
          max_cost: maxCost ? parseInt(maxCost) : null,
          preferred_slots: slots || null,
        }),
      })

      document.getElementById('goalStat').value = ''
      document.getElementById('goalBoost').value = ''
      document.getElementById('goalMaxCost').value = ''
      document.getElementById('goalSlots').value = ''
      document.getElementById('addGoalForm').classList.add('hidden')
      
      loadGoals()
    })

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

    initAuth()
    loadItems()
  </script>
</body>
</html>`)
})

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.get('/api/auth/discord', (c) => {
  const clientId = c.env.DISCORD_CLIENT_ID
  const redirectUri = c.env.DISCORD_REDIRECT_URI
  const scope = 'identify'
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`
  return c.redirect(authUrl)
})

app.get('/api/auth/discord/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) return c.json({ error: 'No code provided' }, 400)

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.DISCORD_CLIENT_ID,
        client_secret: c.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: c.env.DISCORD_REDIRECT_URI,
      }),
    })

    const tokens = await tokenResponse.json()
    if (!tokens.access_token) return c.json({ error: 'Failed to get access token' }, 400)

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    const discordUser = await userResponse.json()

    await c.env.DB.prepare(
      'INSERT INTO users (discord_id, discord_username, created_at) VALUES (?, ?, ?) ON CONFLICT(discord_id) DO UPDATE SET discord_username = ?, last_login = ?'
    ).bind(discordUser.id, discordUser.username, new Date().toISOString(), discordUser.username, new Date().toISOString()).run()

    return c.html(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'discord_auth', user: ${JSON.stringify(discordUser)} }, '*')
            window.close()
          </script>
        </body>
      </html>
    `)
  } catch (error) {
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

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

app.get('/api/goals', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const { results } = await c.env.DB.prepare('SELECT * FROM user_goals WHERE discord_id = ?')
    .bind(discordId)
    .all()

  return c.json({ goals: results })
})

app.post('/api/goals', async (c) => {
  const { discord_id, stat, min_boost, max_cost, preferred_slots } = await c.req.json()
  
  if (!discord_id || !stat || !min_boost) {
    return c.json({ error: 'discord_id, stat, and min_boost required' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO user_goals (discord_id, stat, min_boost, max_cost, preferred_slots, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(discord_id, stat, min_boost, max_cost || null, preferred_slots || null, new Date().toISOString()).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

app.delete('/api/goals/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM user_goals WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.post('/api/scrape', async (c) => {
  try {
    const lastUpdated = await getLastUpdated()
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

    // Update metadata
    if (lastUpdated) {
      await c.env.DB.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)')
        .bind('last_updated', lastUpdated)
        .run()
    }

    // Check for matches and send alerts
    await checkMatches(c.env, items)

    return c.json({ success: true, count: items.length, lastUpdated })
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

        // Check for matches and send alerts
        await checkMatches(env, items)

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
