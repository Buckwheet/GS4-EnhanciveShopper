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
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-semibold">My Alert Goals</h2>
          <div class="flex gap-2">
            <button id="manageCharBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm">
              Manage Character
            </button>
            <button id="manageInvBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm">
              Manage Inventory
            </button>
            <button id="myMatchesBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
              My Matches
            </button>
          </div>
        </div>
        
        <div class="flex gap-2 items-center mb-4">
            <label class="text-sm text-gray-600">Active Set:</label>
            <select id="goalSetSelector" class="border p-2 rounded">
              <option value="Default">Default</option>
            </select>
            <button id="newSetBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm">+ New Set</button>
            <button id="deleteSetBtn" class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm">Delete Set</button>
          </div>
        </div>
        
        <div class="mb-4">
          <button id="addGoalBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
            + Add Goal to Current Set
          </button>
        </div>

        <div id="addGoalForm" class="hidden mb-4 p-4 border rounded bg-gray-50">
          <h3 class="font-semibold mb-3">Create Alert Goal</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input type="text" id="goalStat" placeholder="Stat (e.g., Strength)" class="border p-2 rounded">
            <input type="number" id="goalBoost" placeholder="Min Boost (e.g., 5)" class="border p-2 rounded">
            <input type="number" id="goalMaxCost" placeholder="Max Cost (optional)" class="border p-2 rounded col-span-2">
          </div>
          <div class="mb-3">
            <label class="font-semibold mb-2 block">Preferred Slots (optional):</label>
            <div class="grid grid-cols-3 md:grid-cols-5 gap-2">
              <label class="flex items-center"><input type="checkbox" value="ankle" class="mr-1"> ankle</label>
              <label class="flex items-center"><input type="checkbox" value="arms" class="mr-1"> arms</label>
              <label class="flex items-center"><input type="checkbox" value="belt" class="mr-1"> belt</label>
              <label class="flex items-center"><input type="checkbox" value="chest" class="mr-1"> chest</label>
              <label class="flex items-center"><input type="checkbox" value="cloak" class="mr-1"> cloak</label>
              <label class="flex items-center"><input type="checkbox" value="ear" class="mr-1"> ear</label>
              <label class="flex items-center"><input type="checkbox" value="ears" class="mr-1"> ears</label>
              <label class="flex items-center"><input type="checkbox" value="feet" class="mr-1"> feet</label>
              <label class="flex items-center"><input type="checkbox" value="finger" class="mr-1"> finger</label>
              <label class="flex items-center"><input type="checkbox" value="front" class="mr-1"> front</label>
              <label class="flex items-center"><input type="checkbox" value="hands" class="mr-1"> hands</label>
              <label class="flex items-center"><input type="checkbox" value="head" class="mr-1"> head</label>
              <label class="flex items-center"><input type="checkbox" value="legs" class="mr-1"> legs</label>
              <label class="flex items-center"><input type="checkbox" value="neck" class="mr-1"> neck</label>
              <label class="flex items-center"><input type="checkbox" value="pants" class="mr-1"> pants</label>
              <label class="flex items-center"><input type="checkbox" value="pin" class="mr-1"> pin</label>
              <label class="flex items-center"><input type="checkbox" value="shoulders" class="mr-1"> shoulders</label>
              <label class="flex items-center"><input type="checkbox" value="socks" class="mr-1"> socks</label>
              <label class="flex items-center"><input type="checkbox" value="wrist" class="mr-1"> wrist</label>
            </div>
          </div>
          <div class="flex gap-2">
            <button id="saveGoalBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Save</button>
            <button id="cancelGoalBtn" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Cancel</button>
          </div>
        </div>

        <div id="goalsList" class="space-y-2">
          <p class="text-gray-500">No goals yet. Add one to get started!</p>
        </div>
      </div>
      
      <!-- Create Set Modal -->
      <div id="createSetModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 class="text-2xl font-semibold mb-4">Create New Goal Set</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Set Name</label>
              <input type="text" id="newSetName" placeholder="e.g., Cleric - Hunting" class="border p-2 rounded w-full">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Account Type</label>
              <select id="newSetAccountType" class="border p-2 rounded w-full">
                <option value="F2P">F2P / Standard</option>
                <option value="Premium">Premium</option>
                <option value="Platinum">Platinum</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button id="createSetConfirm" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex-1">Create</button>
              <button id="createSetCancel" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded flex-1">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- My Matches Modal -->
      <div id="myMatchesModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-semibold">My Matches</h2>
            <button id="closeMatchesBtn" class="text-gray-600 hover:text-gray-800 text-2xl">&times;</button>
          </div>
          
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-2 text-green-700">Available Now</h3>
            <div id="availableMatches" class="space-y-2"></div>
          </div>
          
          <div>
            <h3 class="text-lg font-semibold mb-2 text-gray-600">Recently Sold (Last 72 Hours)</h3>
            <div id="soldMatches" class="space-y-2"></div>
          </div>
        </div>
      </div>
      
      <!-- Manage Character Modal -->
      <div id="manageCharModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-semibold">Manage Character Data</h2>
            <button id="closeCharBtn" class="text-gray-600 hover:text-gray-800 text-2xl">&times;</button>
          </div>
          
          <div class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold mb-2">Base Stats</h3>
              <p class="text-sm text-gray-600 mb-2">Paste output from '>stats' command (with all enhancives removed)</p>
              <textarea id="statsInput" rows="12" class="border p-2 rounded w-full font-mono text-sm" placeholder="Paste stats here..."></textarea>
              <button id="parseStatsBtn" class="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Parse Stats</button>
              <div id="parsedStats" class="mt-2 text-sm"></div>
            </div>
            
            <div>
              <h3 class="text-lg font-semibold mb-2">Skill Ranks</h3>
              <p class="text-sm text-gray-600 mb-2">Paste output from '>skill base' command</p>
              <textarea id="skillsInput" rows="12" class="border p-2 rounded w-full font-mono text-sm" placeholder="Paste skills here..."></textarea>
              <button id="parseSkillsBtn" class="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Parse Skills</button>
              <div id="parsedSkills" class="mt-2 text-sm"></div>
            </div>
            
            <button id="saveCharDataBtn" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded w-full">Save Character Data</button>
          </div>
        </div>
      </div>
      
      <!-- Manage Inventory Modal -->
      <div id="manageInvModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-semibold">Manage Inventory</h2>
            <button id="closeInvBtn" class="text-gray-600 hover:text-gray-800 text-2xl">&times;</button>
          </div>
          
          <div class="mb-4">
            <button id="addItemBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">+ Add Enhancive Item</button>
          </div>
          
          <div id="addItemForm" class="hidden mb-6 p-4 border rounded bg-gray-50">
            <h3 class="font-semibold mb-3">Add New Item</h3>
            <textarea id="itemTextInput" rows="15" class="border p-2 rounded w-full font-mono text-sm mb-3" placeholder="Paste item description here..."></textarea>
            <button id="parseItemBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-3">Parse Item</button>
            
            <div id="parsedItemInfo" class="hidden">
              <div class="mb-3">
                <label class="block font-medium mb-1">Item Name</label>
                <input type="text" id="parsedItemName" class="border p-2 rounded w-full">
              </div>
              
              <div class="mb-3">
                <label class="block font-medium mb-1">Enhancives Detected</label>
                <div id="parsedEnhancives" class="text-sm bg-white p-2 border rounded"></div>
              </div>
              
              <div class="mb-3">
                <label class="block font-medium mb-1">Permanent/Temporary</label>
                <div id="parsedPermanence" class="text-sm"></div>
              </div>
              
              <div class="mb-3">
                <label class="block font-medium mb-1">Select Slot</label>
                <div id="slotCheckboxes" class="grid grid-cols-3 gap-2"></div>
              </div>
              
              <div class="flex gap-2">
                <button id="confirmAddItem" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Add to Inventory</button>
                <button id="cancelAddItem" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Cancel</button>
              </div>
            </div>
          </div>
          
          <div id="inventoryList" class="space-y-2"></div>
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
          <p class="text-gray-500 text-xs">Local: <span id="lastUpdatedLocal"></span></p>
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
    let currentGoalSet = 'Default'

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
      
      // Populate goal set selector
      const sets = [...new Set(data.goals.map(g => g.goal_set_name || 'Default'))]
      const setSelector = document.getElementById('goalSetSelector')
      setSelector.innerHTML = sets.map(s => \`<option value="\${s}" \${s === currentGoalSet ? 'selected' : ''}>\${s}</option>\`).join('')
      
      // Filter goals by current set
      const currentSetGoals = data.goals.filter(g => (g.goal_set_name || 'Default') === currentGoalSet)
      
      const goalsList = document.getElementById('goalsList')
      if (currentSetGoals.length === 0) {
        goalsList.innerHTML = '<p class="text-gray-500">No goals in this set. Add one to get started!</p>'
        return
      }

      goalsList.innerHTML = currentSetGoals.map(goal => \`
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

    document.getElementById('goalSetSelector').addEventListener('change', (e) => {
      currentGoalSet = e.target.value
      loadGoals()
    })

    document.getElementById('newSetBtn').addEventListener('click', () => {
      document.getElementById('createSetModal').classList.remove('hidden')
    })

    document.getElementById('createSetCancel').addEventListener('click', () => {
      document.getElementById('createSetModal').classList.add('hidden')
    })

    document.getElementById('createSetConfirm').addEventListener('click', () => {
      const setName = document.getElementById('newSetName').value.trim()
      const accountType = document.getElementById('newSetAccountType').value
      
      if (!setName) {
        alert('Please enter a set name')
        return
      }
      
      currentGoalSet = setName
      
      // Update dropdown immediately
      const setSelector = document.getElementById('goalSetSelector')
      const option = document.createElement('option')
      option.value = currentGoalSet
      option.textContent = \`\${currentGoalSet} (\${accountType})\`
      option.selected = true
      option.dataset.accountType = accountType
      setSelector.appendChild(option)
      
      // Clear goals list for new empty set
      document.getElementById('goalsList').innerHTML = '<p class="text-gray-500">No goals in this set. Add one to get started!</p>'
      
      // Close modal and reset
      document.getElementById('createSetModal').classList.add('hidden')
      document.getElementById('newSetName').value = ''
      document.getElementById('newSetAccountType').value = 'F2P'
    })

    document.getElementById('deleteSetBtn').addEventListener('click', async () => {
      const confirmed = confirm('Delete "' + currentGoalSet + '" and all its goals? This cannot be undone.')
      if (!confirmed) return
      
      // Delete all goals in this set
      const response = await fetch(API_BASE + '/api/goals?discord_id=' + currentUser.id)
      const data = await response.json()
      const goalsToDelete = data.goals.filter(g => (g.goal_set_name || 'Default') === currentGoalSet)
      
      for (const goal of goalsToDelete) {
        await fetch(API_BASE + '/api/goals/' + goal.id, { method: 'DELETE' })
      }
      
      // Delete inventory items for this set
      const invResponse = await fetch(API_BASE + '/api/inventory?discord_id=' + currentUser.id + '&goal_set_name=' + currentGoalSet)
      const invData = await invResponse.json()
      for (const item of invData.items || []) {
        await fetch(API_BASE + '/api/inventory/' + item.id, { method: 'DELETE' })
      }
      
      // Remove from dropdown
      const setSelector = document.getElementById('goalSetSelector')
      const optionToRemove = Array.from(setSelector.options).find(opt => opt.value === currentGoalSet)
      if (optionToRemove) optionToRemove.remove()
      
      // Switch to first remaining set or create Default if none left
      if (setSelector.options.length === 0) {
        const option = document.createElement('option')
        option.value = 'Default'
        option.textContent = 'Default (F2P)'
        option.selected = true
        option.dataset.accountType = 'F2P'
        setSelector.appendChild(option)
        currentGoalSet = 'Default'
      } else {
        currentGoalSet = setSelector.options[0].value
        setSelector.value = currentGoalSet
      }
      
      loadGoals()
    })
    })

    window.deleteGoal = async function(id) {
      if (!confirm('Delete this goal?')) return
      await fetch(API_BASE + '/api/goals/' + id, { method: 'DELETE' })
      loadGoals()
    }

    let parsedStatsData = null
    let parsedSkillsData = null
    let parsedItemData = null

    document.getElementById('manageCharBtn').addEventListener('click', () => {
      document.getElementById('manageCharModal').classList.remove('hidden')
    })

    document.getElementById('closeCharBtn').addEventListener('click', () => {
      document.getElementById('manageCharModal').classList.add('hidden')
    })

    document.getElementById('parseStatsBtn').addEventListener('click', () => {
      const text = document.getElementById('statsInput').value
      // Simple parser for stats
      const stats = {}
      const lines = text.split('\\n')
      const statNames = ['STR', 'CON', 'DEX', 'AGI', 'DIS', 'AUR', 'LOG', 'INT', 'WIS', 'INF']
      
      for (const line of lines) {
        for (const stat of statNames) {
          if (line.includes(\`(\${stat})\`)) {
            const match = line.match(/\\((\\d+)\\)/)
            if (match) {
              stats[stat] = parseInt(match[1])
            }
          }
        }
      }
      
      parsedStatsData = stats
      document.getElementById('parsedStats').innerHTML = '<div class="bg-green-50 p-2 border border-green-200 rounded">' + 
        Object.entries(stats).map(([k, v]) => \`\${k}: \${v}\`).join(', ') + '</div>'
    })

    document.getElementById('parseSkillsBtn').addEventListener('click', () => {
      const text = document.getElementById('skillsInput').value
      const skills = {}
      const lines = text.split('\\n')
      
      for (const line of lines) {
        const match = line.match(/^  (.+?)\\.+\\|\\s+\\d+\\s+(\\d+)/)
        if (match) {
          const skillName = match[1].trim()
          const ranks = parseInt(match[2])
          skills[skillName] = ranks
        }
      }
      
      parsedSkillsData = skills
      document.getElementById('parsedSkills').innerHTML = '<div class="bg-green-50 p-2 border border-green-200 rounded max-h-40 overflow-y-auto">' + 
        Object.entries(skills).map(([k, v]) => \`\${k}: \${v}\`).join('<br>') + '</div>'
    })

    document.getElementById('saveCharDataBtn').addEventListener('click', async () => {
      if (!parsedStatsData && !parsedSkillsData) {
        alert('Please parse stats and/or skills first')
        return
      }
      
      await fetch(API_BASE + '/api/goal-set/' + currentUser.id + '/' + currentGoalSet, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: null,
          base_stats: parsedStatsData ? JSON.stringify(parsedStatsData) : null,
          skill_ranks: parsedSkillsData ? JSON.stringify(parsedSkillsData) : null
        })
      })
      
      alert('Character data saved!')
      document.getElementById('manageCharModal').classList.add('hidden')
    })

    document.getElementById('manageInvBtn').addEventListener('click', async () => {
      document.getElementById('manageInvModal').classList.remove('hidden')
      await loadInventory()
    })

    document.getElementById('closeInvBtn').addEventListener('click', () => {
      document.getElementById('manageInvModal').classList.add('hidden')
    })

    document.getElementById('addItemBtn').addEventListener('click', () => {
      document.getElementById('addItemForm').classList.remove('hidden')
    })

    document.getElementById('cancelAddItem').addEventListener('click', () => {
      document.getElementById('addItemForm').classList.add('hidden')
      document.getElementById('parsedItemInfo').classList.add('hidden')
    })

    document.getElementById('parseItemBtn').addEventListener('click', () => {
      const text = document.getElementById('itemTextInput').value
      
      // Parse enhancives
      const enhancives = []
      const lines = text.split('\\n')
      let isPermanent = true
      let detectedSlot = null
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        if (line.includes('crumble into dust')) {
          isPermanent = false
        }
        
        const boostMatch = line.match(/It provides a boost of (\\d+) to (.+)\\./);
        if (boostMatch) {
          const boost = parseInt(boostMatch[1])
          const ability = boostMatch[2].trim()
          enhancives.push({ boost, ability })
        }
        
        const slotMatch = line.match(/You could (wear|put|attach|slip|hang|drape|sling).+?(around your neck|on your head|on your fingers?|on your wrists?|around your waist|on your back|over your shoulders?|on your feet|on your hands|on your arms|on your legs|on your ankle|in your hair|from.+?ears?|over your chest|over your front|on your belt|as a pin)/i)
        if (slotMatch) {
          const location = slotMatch[2].toLowerCase()
          if (location.includes('neck')) detectedSlot = 'neck'
          else if (location.includes('head')) detectedSlot = 'head'
          else if (location.includes('hair')) detectedSlot = 'hair'
          else if (location.includes('single ear')) detectedSlot = 'single_ear'
          else if (location.includes('both ears')) detectedSlot = 'both_ears'
          else if (location.includes('shoulder') && location.includes('over')) detectedSlot = 'shoulders_draped'
          else if (location.includes('shoulder')) detectedSlot = 'shoulder_slung'
          else if (location.includes('back')) detectedSlot = 'back'
          else if (location.includes('chest')) detectedSlot = 'chest'
          else if (location.includes('front')) detectedSlot = 'front'
          else if (location.includes('arms')) detectedSlot = 'arms'
          else if (location.includes('wrist')) detectedSlot = 'wrist'
          else if (location.includes('hands')) detectedSlot = 'hands'
          else if (location.includes('finger')) detectedSlot = 'fingers'
          else if (location.includes('waist')) detectedSlot = 'waist'
          else if (location.includes('belt')) detectedSlot = 'belt'
          else if (location.includes('legs')) detectedSlot = 'legs_attached'
          else if (location.includes('ankle')) detectedSlot = 'ankle'
          else if (location.includes('feet')) detectedSlot = 'feet_on'
          else if (location.includes('pin')) detectedSlot = 'pin'
        }
      }
      
      parsedItemData = { enhancives, isPermanent, detectedSlot }
      
      // Extract item name from first line or prompt
      const nameMatch = text.match(/^(.+?)\\n/)
      const itemName = nameMatch ? nameMatch[1].trim() : 'Unknown Item'
      document.getElementById('parsedItemName').value = itemName
      
      document.getElementById('parsedEnhancives').innerHTML = enhancives.map(e => 
        \`+\${e.boost} \${e.ability}\`
      ).join('<br>')
      
      document.getElementById('parsedPermanence').innerHTML = isPermanent ? 
        '<span class="text-green-600">✓ Permanent</span>' : 
        '<span class="text-red-600">⚠ Temporary (will crumble)</span>'
      
      // Show slot checkboxes
      const slots = ['pin', 'head', 'hair', 'single_ear', 'both_ears', 'neck', 'shoulder_slung', 'shoulders_draped', 
                     'chest', 'front', 'back', 'arms', 'wrist', 'hands', 'fingers', 'waist', 'belt', 
                     'legs_attached', 'ankle', 'feet_on']
      
      document.getElementById('slotCheckboxes').innerHTML = slots.map(slot => 
        \`<label class="flex items-center">
          <input type="radio" name="itemSlot" value="\${slot}" \${slot === detectedSlot ? 'checked' : ''} class="mr-1">
          \${slot.replace(/_/g, ' ')}
        </label>\`
      ).join('')
      
      document.getElementById('parsedItemInfo').classList.remove('hidden')
    })

    document.getElementById('confirmAddItem').addEventListener('click', async () => {
      const itemName = document.getElementById('parsedItemName').value
      const selectedSlot = document.querySelector('input[name="itemSlot"]:checked')?.value
      
      if (!itemName || !selectedSlot || !parsedItemData) {
        alert('Please complete all fields')
        return
      }
      
      await fetch(API_BASE + '/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_id: currentUser.id,
          goal_set_name: currentGoalSet,
          item_name: itemName,
          slot: selectedSlot,
          enhancives_json: JSON.stringify(parsedItemData.enhancives),
          is_permanent: parsedItemData.isPermanent
        })
      })
      
      alert('Item added to inventory!')
      document.getElementById('addItemForm').classList.add('hidden')
      document.getElementById('parsedItemInfo').classList.add('hidden')
      document.getElementById('itemTextInput').value = ''
      await loadInventory()
    })

    async function loadInventory() {
      const response = await fetch(API_BASE + '/api/inventory?discord_id=' + currentUser.id + '&goal_set_name=' + currentGoalSet)
      const data = await response.json()
      
      const invList = document.getElementById('inventoryList')
      if (data.items.length === 0) {
        invList.innerHTML = '<p class="text-gray-500">No items in inventory. Add one to get started!</p>'
        return
      }
      
      invList.innerHTML = data.items.map(item => {
        const enhs = JSON.parse(item.enhancives_json)
        const enhText = enhs.map(e => \`+\${e.boost} \${e.ability}\`).join(', ')
        return \`
          <div class="p-3 border rounded \${item.is_permanent ? 'bg-white' : 'bg-yellow-50'}">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="font-semibold">\${item.item_name}</div>
                <div class="text-sm text-gray-600">Slot: \${item.slot.replace(/_/g, ' ')}</div>
                <div class="text-sm text-gray-700">\${enhText}</div>
                \${!item.is_permanent ? '<div class="text-xs text-orange-600 mt-1">⚠ Temporary (will crumble)</div>' : ''}
              </div>
              <button onclick="deleteInventoryItem(\${item.id})" class="text-red-600 hover:text-red-800 text-sm">Delete</button>
            </div>
          </div>
        \`
      }).join('')
    }

    window.deleteInventoryItem = async function(id) {
      if (!confirm('Delete this item from inventory?')) return
      await fetch(API_BASE + '/api/inventory/' + id, { method: 'DELETE' })
      await loadInventory()
    }

    document.getElementById('myMatchesBtn').addEventListener('click', async () => {
      const response = await fetch(API_BASE + '/api/my-matches?discord_id=' + currentUser.id)
      const data = await response.json()
      
      const availableDiv = document.getElementById('availableMatches')
      const soldDiv = document.getElementById('soldMatches')
      
      if (data.available.length === 0) {
        availableDiv.innerHTML = '<p class="text-gray-500">No available matches yet</p>'
      } else {
        availableDiv.innerHTML = data.available.map(item => {
          const enhs = JSON.parse(item.enhancives_json)
          const enhText = enhs.map(e => \`+\${e.boost} \${e.ability}\`).join(', ')
          return \`
            <div class="p-3 border rounded bg-green-50">
              <div class="font-semibold">\${item.name}</div>
              <div class="text-sm text-gray-600">\${item.town} - \${item.shop} - \${item.cost?.toLocaleString()} silvers</div>
              <div class="text-sm text-gray-700">\${enhText}</div>
            </div>
          \`
        }).join('')
      }
      
      if (data.recentlySold.length === 0) {
        soldDiv.innerHTML = '<p class="text-gray-500">No recently sold items</p>'
      } else {
        soldDiv.innerHTML = data.recentlySold.map(item => {
          const enhs = JSON.parse(item.enhancives_json)
          const enhText = enhs.map(e => \`+\${e.boost} \${e.ability}\`).join(', ')
          const soldDate = new Date(item.unavailable_since).toLocaleString()
          return \`
            <div class="p-3 border rounded bg-gray-100">
              <div class="font-semibold text-gray-600">\${item.name}</div>
              <div class="text-sm text-gray-500">\${item.town} - \${item.shop} - \${item.cost?.toLocaleString()} silvers</div>
              <div class="text-sm text-gray-600">\${enhText}</div>
              <div class="text-xs text-gray-500 mt-1">Sold: \${soldDate}</div>
            </div>
          \`
        }).join('')
      }
      
      document.getElementById('myMatchesModal').classList.remove('hidden')
    })

    document.getElementById('closeMatchesBtn').addEventListener('click', () => {
      document.getElementById('myMatchesModal').classList.add('hidden')
    })

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
      const selectedSlots = Array.from(document.querySelectorAll('#addGoalForm input[type="checkbox"]:checked'))
        .map(cb => cb.value)
        .join(',')

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
          preferred_slots: selectedSlots || null,
          goal_set_name: currentGoalSet,
        }),
      })

      document.getElementById('goalStat').value = ''
      document.getElementById('goalBoost').value = ''
      document.getElementById('goalMaxCost').value = ''
      document.querySelectorAll('#addGoalForm input[type="checkbox"]').forEach(cb => cb.checked = false)
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
        
        if (data.lastUpdated && data.lastUpdated !== 'Never') {
          const localTime = new Date(data.lastUpdated).toLocaleString()
          document.getElementById('lastUpdatedLocal').textContent = localTime
        }
        
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
    console.log('Token response:', tokens)
    
    if (!tokens.access_token) {
      return c.json({ error: 'Failed to get access token', details: tokens }, 400)
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    const discordUser = await userResponse.json()
    console.log('Discord user:', discordUser)

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
    console.error('Auth error:', error)
    return c.json({ error: 'Authentication failed', details: String(error) }, 500)
  }
})

app.get('/api/items', async (c) => {
  const showUnavailable = c.req.query('show_unavailable') === 'true'
  
  const query = showUnavailable 
    ? 'SELECT * FROM shop_items ORDER BY available DESC, scraped_at DESC'
    : 'SELECT * FROM shop_items WHERE available = 1 ORDER BY scraped_at DESC'
  
  const { results } = await c.env.DB.prepare(query).all()
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
  const { discord_id, stat, min_boost, max_cost, preferred_slots, goal_set_name, account_type, base_stats, skill_ranks } = await c.req.json()
  
  if (!discord_id || !stat || !min_boost) {
    return c.json({ error: 'discord_id, stat, and min_boost required' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO user_goals (discord_id, stat, min_boost, max_cost, preferred_slots, goal_set_name, account_type, base_stats, skill_ranks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(discord_id, stat, min_boost, max_cost || null, preferred_slots || null, goal_set_name || 'Default', account_type || 'F2P', base_stats || null, skill_ranks || null, new Date().toISOString()).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/api/goal-set/:discord_id/:set_name', async (c) => {
  const discordId = c.req.param('discord_id')
  const setName = c.req.param('set_name')
  const { account_type, base_stats, skill_ranks } = await c.req.json()

  await c.env.DB.prepare(
    'UPDATE user_goals SET account_type = ?, base_stats = ?, skill_ranks = ? WHERE discord_id = ? AND goal_set_name = ?'
  ).bind(account_type, base_stats, skill_ranks, discordId, setName).run()

  return c.json({ success: true })
})

app.delete('/api/goals/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM user_goals WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.post('/api/test-dm', async (c) => {
  const { discord_id } = await c.req.json()
  if (!discord_id) return c.json({ error: 'discord_id required' }, 400)

  try {
    const message = '🔔 Test alert from GS4 Enhancive Shopper! If you see this, notifications are working.'
    const sent = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${c.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: discord_id }),
    })

    const channel = await sent.json()
    console.log('Channel response:', channel)

    if (!channel.id) {
      return c.json({ error: 'Failed to create DM channel', details: channel }, 400)
    }

    const msgResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${c.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message }),
    })

    const result = await msgResponse.json()
    console.log('Message response:', result)

    return c.json({ success: msgResponse.ok, details: result })
  } catch (error) {
    console.error('Test DM error:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.get('/api/debug/alerts', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const { results: goals } = await c.env.DB.prepare('SELECT * FROM user_goals WHERE discord_id = ?').bind(discordId).all()
  const { results: alerts } = await c.env.DB.prepare('SELECT * FROM alerts WHERE discord_id = ? ORDER BY sent_at DESC LIMIT 10').bind(discordId).all()
  
  // Find matching items
  const { results: allItems } = await c.env.DB.prepare('SELECT * FROM shop_items WHERE available = 1').all()
  
  const matches = []
  if (goals.length > 0) {
    const goal = goals[0]
    for (const item of allItems.slice(0, 100)) {
      try {
        const enhancives = JSON.parse(item.enhancives_json)
        const hasMatch = enhancives.some((enh: any) => 
          enh.ability.toLowerCase().includes(goal.stat.toLowerCase()) && enh.boost >= goal.min_boost
        )
        if (hasMatch) {
          matches.push({ id: item.id, name: item.name, enhancives })
        }
      } catch {}
    }
  }

  return c.json({ goals, alerts, matchingItems: matches.slice(0, 5) })
})

app.post('/api/test-match', async (c) => {
  try {
    const { results: items } = await c.env.DB.prepare('SELECT * FROM shop_items WHERE available = 1').all()
    console.log(`Testing matcher with ${items.length} items`)
    
    await checkMatches(c.env, items)
    
    const { results: alerts } = await c.env.DB.prepare('SELECT * FROM alerts ORDER BY sent_at DESC LIMIT 10').all()
    
    return c.json({ success: true, itemsChecked: items.length, totalAlerts: alerts.length, recentAlerts: alerts })
  } catch (error) {
    console.error('Test match error:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.post('/api/inventory', async (c) => {
  const { discord_id, goal_set_name, item_name, slot, enhancives_json, is_permanent } = await c.req.json()
  
  if (!discord_id || !goal_set_name || !item_name || !slot) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO user_inventory (discord_id, goal_set_name, item_name, slot, enhancives_json, is_permanent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(discord_id, goal_set_name, item_name, slot, enhancives_json, is_permanent ? 1 : 0, new Date().toISOString()).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

app.get('/api/inventory', async (c) => {
  const discordId = c.req.query('discord_id')
  const goalSetName = c.req.query('goal_set_name')
  
  if (!discordId || !goalSetName) {
    return c.json({ error: 'discord_id and goal_set_name required' }, 400)
  }

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM user_inventory WHERE discord_id = ? AND goal_set_name = ?'
  ).bind(discordId, goalSetName).all()

  return c.json({ items: results })
})

app.delete('/api/inventory/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM user_inventory WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.post('/api/my-matches', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  // Get all alerts for this user with item details
  const { results } = await c.env.DB.prepare(`
    SELECT 
      a.id as alert_id,
      a.sent_at,
      a.delivered,
      i.*
    FROM alerts a
    JOIN shop_items i ON a.item_id = i.id
    WHERE a.discord_id = ?
    ORDER BY a.sent_at DESC
  `).bind(discordId).all()

  // Separate into available and recently sold
  const available = results.filter((r: any) => r.available === 1)
  const recentlySold = results.filter((r: any) => r.available === 0)

  return c.json({ available, recentlySold })
})

app.post('/api/scrape', async (c) => {
  try {
    const lastUpdated = await getLastUpdated()
    const items = await scrapeEnhancives()
    const now = new Date().toISOString()
    
    // Get current item IDs from database
    const { results: existingItems } = await c.env.DB.prepare('SELECT id FROM shop_items WHERE available = 1').all()
    const existingIds = new Set(existingItems.map((i: any) => i.id))
    const scrapedIds = new Set(items.map(i => i.id))
    
    // Find items that were removed (in DB but not in scrape)
    const removedIds = [...existingIds].filter(id => !scrapedIds.has(id))
    
    // Only mark removed items as unavailable (not all items)
    if (removedIds.length > 0) {
      const placeholders = removedIds.map(() => '?').join(',')
      await c.env.DB.prepare(`UPDATE shop_items SET available = 0, unavailable_since = ? WHERE id IN (${placeholders})`)
        .bind(now, ...removedIds).run()
      console.log(`Marked ${removedIds.length} items as unavailable`)
    }
    
    // Only insert truly new items (not in DB at all)
    const newItems = items.filter(item => !existingIds.has(item.id))
    
    if (newItems.length > 0) {
      const stmt = c.env.DB.prepare(
        `INSERT INTO shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at, last_seen, available)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      
      const batch = newItems.map(item => 
        stmt.bind(
          item.id,
          item.name,
          item.town,
          item.shop,
          item.cost,
          item.enchant,
          item.worn,
          JSON.stringify(item.enhancives),
          now,
          now
        )
      )
      
      await c.env.DB.batch(batch)
      console.log(`Inserted ${newItems.length} new items`)
    }

    // Update metadata
    if (lastUpdated) {
      await c.env.DB.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)')
        .bind('last_updated', lastUpdated)
        .run()
    }

    // Check for matches and send alerts (only new items)
    console.log(`Checking ${newItems.length} new items for alerts`)
    await checkMatches(c.env, newItems)

    return c.json({ success: true, total: items.length, new: newItems.length, removed: removedIds.length, lastUpdated })
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
        const now = new Date().toISOString()

        // Get current item IDs from database
        const { results: existingItems } = await env.DB.prepare('SELECT id FROM shop_items WHERE available = 1').all()
        const existingIds = new Set(existingItems.map((i: any) => i.id))
        const scrapedIds = new Set(items.map(i => i.id))
        
        // Find items that were removed
        const removedIds = [...existingIds].filter(id => !scrapedIds.has(id))
        
        // Only mark removed items as unavailable
        if (removedIds.length > 0) {
          const placeholders = removedIds.map(() => '?').join(',')
          await env.DB.prepare(`UPDATE shop_items SET available = 0, unavailable_since = ? WHERE id IN (${placeholders})`)
            .bind(now, ...removedIds).run()
          console.log(`Marked ${removedIds.length} items as unavailable`)
        }
        
        // Only insert truly new items
        const newItems = items.filter(item => !existingIds.has(item.id))
        
        if (newItems.length > 0) {
          const stmt = env.DB.prepare(
            `INSERT INTO shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at, last_seen, available)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
          )
          
          const batch = newItems.map(item => 
            stmt.bind(
              item.id,
              item.name,
              item.town,
              item.shop,
              item.cost,
              item.enchant,
              item.worn,
              JSON.stringify(item.enhancives),
              now,
              now
            )
          )
          
          await env.DB.batch(batch)
          console.log(`Inserted ${newItems.length} new items`)
        }

        // Check for matches and send alerts (only new items)
        await checkMatches(env, newItems)

        await env.DB.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)')
          .bind('last_updated', lastUpdated)
          .run()

        console.log(`Scrape complete: ${items.length} total, ${newItems.length} new, ${removedIds.length} removed`)
      }
      
      // Cleanup: Delete items unavailable for more than 72 hours
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
      const { meta } = await env.DB.prepare(
        'DELETE FROM shop_items WHERE available = 0 AND unavailable_since < ?'
      ).bind(cutoff).run()
      
      if (meta.changes > 0) {
        console.log(`Cleaned up ${meta.changes} items older than 72 hours`)
      }
    } catch (error) {
      console.error('Scheduled scrape error:', error)
    }
  },
}
