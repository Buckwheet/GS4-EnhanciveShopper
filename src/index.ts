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
          <h2 class="text-2xl font-semibold">My Characters</h2>
          <button id="myMatchesBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            My Matches
          </button>
        </div>
        
        <div class="flex gap-2 items-center mb-4">
          <label class="text-sm text-gray-600">Character:</label>
          <select id="characterSelector" class="border p-2 rounded flex-1">
            <option value="">No characters yet</option>
          </select>
          <button id="newCharBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm">+ New</button>
          <button id="deleteCharBtn" class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm" disabled>Delete</button>
        </div>
        
        <div id="noCharWarning" class="mb-4 p-3 bg-red-50 border border-red-200 rounded hidden">
          <p class="text-red-700 text-sm font-semibold">⚠ Create a character first</p>
        </div>
        
        <div id="characterDetails" class="hidden space-y-4">
          <div class="border-t pt-4 flex gap-2 items-center">
            <span class="font-semibold">Account:</span>
            <span id="accountTypeBadge" class="px-2 py-1 bg-gray-100 rounded text-sm"></span>
            <button id="editStatsBtn" class="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm">Edit Stats/Skills</button>
          </div>
          
          <div class="border-t pt-4">
            <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold">Equipment</h3>
              <div class="flex gap-2">
                <select id="equipSetSelector" class="border p-2 rounded text-sm"><option value="Default">Default</option></select>
                <button id="newEquipSetBtn" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm">+ Set</button>
                <button id="manageEquipBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm">Manage</button>
              </div>
            </div>
          </div>
          
          <div class="border-t pt-4">
            <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold">Alert Goals</h3>
              <button id="addGoalBtn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm">+ Add</button>
            </div>
            <div id="goalsList" class="space-y-2"><p class="text-gray-500 text-sm">No goals yet</p></div>
          </div>
        </div>
      </div>
      
      <!-- Create Character Modal -->
      <div id="createCharModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 class="text-2xl font-semibold mb-4">Create Character</h2>
          <input type="text" id="newCharName" placeholder="Character Name" class="border p-2 rounded w-full mb-3">
          <select id="newCharAccountType" class="border p-2 rounded w-full mb-4">
            <option value="F2P">F2P / Standard</option>
            <option value="Premium">Premium</option>
            <option value="Platinum">Platinum</option>
          </select>
          <div class="flex gap-2">
            <button id="createCharConfirm" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex-1">Create</button>
            <button id="createCharCancel" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded flex-1">Cancel</button>
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
  
  <!-- Edit Stats/Skills Modal -->
  <div id="editStatsModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      <h2 class="text-2xl font-semibold mb-4">Edit Stats/Skills</h2>
      <textarea id="statsInput" rows="10" class="border p-2 rounded w-full mb-2 font-mono text-sm" placeholder="Paste >stats output"></textarea>
      <button id="parseStatsBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-2">Parse Stats</button>
      <div id="parsedStatsResult" class="mb-4 text-sm"></div>
      <textarea id="skillsInput" rows="10" class="border p-2 rounded w-full mb-2 font-mono text-sm" placeholder="Paste >skill base output"></textarea>
      <button id="parseSkillsBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-2">Parse Skills</button>
      <div id="parsedSkillsResult" class="mb-4 text-sm"></div>
      <div class="flex gap-2">
        <button id="saveStatsBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex-1">Save</button>
        <button id="closeStatsBtn" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded flex-1">Cancel</button>
      </div>
    </div>
  </div>
  
  <!-- Manage Equipment Modal -->
  <div id="manageEquipModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
      <h2 class="text-2xl font-semibold mb-4">Manage Equipment</h2>
      <button id="addEquipItemBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mb-4">+ Add Item</button>
      <div id="addEquipForm" class="hidden mb-4 p-4 border rounded">
        <textarea id="equipItemText" rows="15" class="border p-2 rounded w-full mb-2 font-mono text-sm" placeholder="Paste item description"></textarea>
        <button id="parseEquipBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-2">Parse</button>
        <div id="equipParseResult" class="mb-2 text-sm"></div>
        <input type="text" id="equipItemName" placeholder="Item Name" class="border p-2 rounded w-full mb-2">
        <div id="equipSlotRadios" class="hidden mb-2 grid grid-cols-4 gap-2 text-sm"></div>
        <button id="saveEquipBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Save Item</button>
      </div>
      <div id="equipmentList" class="space-y-2"></div>
      <button id="closeEquipBtn" class="mt-4 bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Close</button>
    </div>
  </div>
  
  <!-- Add Goal Modal -->
  <div id="addGoalModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-md w-full">
      <h2 class="text-2xl font-semibold mb-4">Add Alert Goal</h2>
      <input type="text" id="goalStat" placeholder="Stat (e.g., Strength)" class="border p-2 rounded w-full mb-2">
      <input type="number" id="goalMinBoost" placeholder="Min Boost" class="border p-2 rounded w-full mb-2">
      <input type="number" id="goalMaxCost" placeholder="Max Cost (optional)" class="border p-2 rounded w-full mb-4">
      <div class="flex gap-2">
        <button id="saveGoalBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex-1">Save</button>
        <button id="closeGoalBtn" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded flex-1">Cancel</button>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = window.location.origin
    let allItems = []
    let filteredItems = []
    let currentUser = null
    let currentCharacter = null
    let currentEquipSet = 'Default'
    let parsedStatsData = null
    let parsedSkillsData = null
    let parsedItemData = null
    let allCharacters = []

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
      loadCharacters()
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

    async function loadCharacters() {
      const response = await fetch(API_BASE + '/api/characters?discord_id=' + currentUser.id)
      const data = await response.json()
      allCharacters = data.characters
      
      const selector = document.getElementById('characterSelector')
      if (allCharacters.length === 0) {
        selector.innerHTML = '<option value="">No characters yet</option>'
        document.getElementById('noCharWarning').classList.remove('hidden')
        document.getElementById('characterDetails').classList.add('hidden')
        document.getElementById('deleteCharBtn').disabled = true
        return
      }
      
      selector.innerHTML = allCharacters.map(c => 
        \`<option value="\${c.id}">\${c.character_name} (\${c.account_type})</option>\`
      ).join('')
      
      document.getElementById('noCharWarning').classList.add('hidden')
      document.getElementById('deleteCharBtn').disabled = false
      currentCharacter = allCharacters[0]
      selector.value = currentCharacter.id
      loadCharacterDetails()
    }

    async function loadCharacterDetails() {
      if (!currentCharacter) return
      document.getElementById('characterDetails').classList.remove('hidden')
      document.getElementById('accountTypeBadge').textContent = currentCharacter.account_type
      await loadGoals()
    }

    async function loadGoals() {
      if (!currentCharacter) return
      const response = await fetch(API_BASE + '/api/alert-goals?character_id=' + currentCharacter.id)
      const data = await response.json()
      
      const goalsList = document.getElementById('goalsList')
      if (data.goals.length === 0) {
        goalsList.innerHTML = '<p class="text-gray-500 text-sm">No goals yet</p>'
        return
      }
      
      goalsList.innerHTML = data.goals.map(goal => \`
        <div class="flex justify-between items-center p-2 border rounded text-sm">
          <div><span class="font-semibold">\${goal.stat}</span> +\${goal.min_boost}\${goal.max_cost ? \` • Max: \${goal.max_cost.toLocaleString()}\` : ''}</div>
          <button onclick="deleteGoal(\${goal.id})" class="text-red-600 hover:text-red-800 text-xs">Delete</button>
        </div>
      \`).join('')
    }

    window.deleteGoal = async function(id) {
      if (!confirm('Delete this goal?')) return
      await fetch(API_BASE + '/api/alert-goals/' + id, { method: 'DELETE' })
      loadGoals()
    }

    async function loadEquipment() {
      if (!currentCharacter) return
      const response = await fetch(API_BASE + '/api/equipment?character_id=' + currentCharacter.id + '&set_name=' + currentEquipSet)
      const data = await response.json()
      
      const list = document.getElementById('equipmentList')
      if (data.items.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-sm">No items yet</p>'
        return
      }
      
      list.innerHTML = data.items.map(item => {
        const enhs = JSON.parse(item.enhancives_json)
        return \`
          <div class="p-2 border rounded text-sm">
            <div class="flex justify-between">
              <div><strong>\${item.item_name}</strong> (\${item.slot})</div>
              <button onclick="deleteEquipItem(\${item.id})" class="text-red-600 hover:text-red-800 text-xs">Delete</button>
            </div>
            <div class="text-xs text-gray-600">\${enhs.map(e => \`+\${e.boost} \${e.ability}\`).join(', ')}</div>
          </div>
        \`
      }).join('')
    }

    window.deleteEquipItem = async function(id) {
      if (!confirm('Delete this item?')) return
      await fetch(API_BASE + '/api/equipment/' + id, { method: 'DELETE' })
      loadEquipment()
    }
      }
    })

    // Character Management Handlers
    document.getElementById('characterSelector').addEventListener('change', (e) => {
      const id = parseInt(e.target.value)
      currentCharacter = allCharacters.find(c => c.id === id)
      loadCharacterDetails()
    })

    document.getElementById('newCharBtn').addEventListener('click', () => {
      document.getElementById('createCharModal').classList.remove('hidden')
    })

    document.getElementById('createCharConfirm').addEventListener('click', async () => {
      const name = document.getElementById('newCharName').value.trim()
      const accountType = document.getElementById('newCharAccountType').value
      if (!name) return alert('Enter a name')
      
      await fetch(API_BASE + '/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discord_id: currentUser.id, character_name: name, account_type: accountType })
      })
      
      document.getElementById('createCharModal').classList.add('hidden')
      document.getElementById('newCharName').value = ''
      loadCharacters()
    })

    document.getElementById('createCharCancel').addEventListener('click', () => {
      document.getElementById('createCharModal').classList.add('hidden')
    })

    document.getElementById('deleteCharBtn').addEventListener('click', async () => {
      if (!confirm('Delete ' + currentCharacter.character_name + '?')) return
      await fetch(API_BASE + '/api/characters/' + currentCharacter.id, { method: 'DELETE' })
      loadCharacters()
    })

    // Stats/Skills Handlers
    document.getElementById('editStatsBtn').addEventListener('click', () => {
      document.getElementById('editStatsModal').classList.remove('hidden')
    })

    document.getElementById('parseStatsBtn').addEventListener('click', () => {
      const text = document.getElementById('statsInput').value
      parsedStatsData = parseStats(text)
      document.getElementById('parsedStatsResult').innerHTML = '<div class="bg-green-50 p-2 border rounded">' + 
        Object.entries(parsedStatsData).map(([k, v]) => \`\${k}: \${v}\`).join(', ') + '</div>'
    })

    document.getElementById('parseSkillsBtn').addEventListener('click', () => {
      const text = document.getElementById('skillsInput').value
      parsedSkillsData = parseSkills(text)
      document.getElementById('parsedSkillsResult').innerHTML = '<div class="bg-green-50 p-2 border rounded max-h-40 overflow-y-auto">' + 
        Object.entries(parsedSkillsData).map(([k, v]) => \`\${k}: \${v}\`).join('<br>') + '</div>'
    })

    document.getElementById('saveStatsBtn').addEventListener('click', async () => {
      await fetch(API_BASE + '/api/characters/' + currentCharacter.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_stats: JSON.stringify(parsedStatsData), skill_ranks: JSON.stringify(parsedSkillsData) })
      })
      alert('Saved!')
      document.getElementById('editStatsModal').classList.add('hidden')
    })

    document.getElementById('closeStatsBtn').addEventListener('click', () => {
      document.getElementById('editStatsModal').classList.add('hidden')
    })

    // Equipment Handlers
    document.getElementById('equipSetSelector').addEventListener('change', (e) => {
      currentEquipSet = e.target.value
      loadEquipment()
    })

    document.getElementById('newEquipSetBtn').addEventListener('click', () => {
      const name = prompt('Enter set name:')
      if (name) {
        const option = document.createElement('option')
        option.value = name
        option.textContent = name
        document.getElementById('equipSetSelector').appendChild(option)
        document.getElementById('equipSetSelector').value = name
        currentEquipSet = name
      }
    })

    document.getElementById('manageEquipBtn').addEventListener('click', () => {
      document.getElementById('manageEquipModal').classList.remove('hidden')
      loadEquipment()
    })

    document.getElementById('addEquipItemBtn').addEventListener('click', () => {
      document.getElementById('addEquipForm').classList.remove('hidden')
    })

    document.getElementById('parseEquipBtn').addEventListener('click', () => {
      const text = document.getElementById('equipItemText').value
      parsedItemData = parseItemText(text)
      
      const nameMatch = text.match(/^(.+?)\\n/)
      document.getElementById('equipItemName').value = nameMatch ? nameMatch[1].trim() : ''
      
      document.getElementById('equipParseResult').innerHTML = '<div class="bg-green-50 p-2 border rounded">' +
        parsedItemData.enhancives.map(e => \`+\${e.boost} \${e.ability}\`).join(', ') +
        (parsedItemData.isPermanent ? ' <span class="text-green-600">✓ Permanent</span>' : ' <span class="text-red-600">⚠ Temporary</span>') +
        '</div>'
      
      const slots = ['pin', 'head', 'hair', 'single_ear', 'both_ears', 'neck', 'shoulder_slung', 'shoulders_draped', 
                     'chest', 'front', 'back', 'arms', 'wrist', 'hands', 'fingers', 'waist', 'belt', 'legs', 'ankle', 'feet']
      document.getElementById('equipSlotRadios').innerHTML = slots.map(slot => 
        \`<label class="flex items-center"><input type="radio" name="equipSlot" value="\${slot}" \${slot === parsedItemData.slot ? 'checked' : ''}> \${slot}</label>\`
      ).join('')
      document.getElementById('equipSlotRadios').classList.remove('hidden')
    })

    document.getElementById('saveEquipBtn').addEventListener('click', async () => {
      const itemName = document.getElementById('equipItemName').value
      const slot = document.querySelector('input[name="equipSlot"]:checked')?.value
      if (!itemName || !slot) return alert('Complete all fields')
      
      await fetch(API_BASE + '/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: currentCharacter.id,
          set_name: currentEquipSet,
          item_name: itemName,
          slot: slot,
          enhancives_json: JSON.stringify(parsedItemData.enhancives),
          is_permanent: parsedItemData.isPermanent
        })
      })
      
      document.getElementById('addEquipForm').classList.add('hidden')
      document.getElementById('equipItemText').value = ''
      loadEquipment()
    })

    document.getElementById('closeEquipBtn').addEventListener('click', () => {
      document.getElementById('manageEquipModal').classList.add('hidden')
    })

    // Goal Handlers
    document.getElementById('addGoalBtn').addEventListener('click', () => {
      document.getElementById('addGoalModal').classList.remove('hidden')
    })

    document.getElementById('saveGoalBtn').addEventListener('click', async () => {
      const stat = document.getElementById('goalStat').value.trim()
      const minBoost = parseInt(document.getElementById('goalMinBoost').value)
      const maxCost = document.getElementById('goalMaxCost').value ? parseInt(document.getElementById('goalMaxCost').value) : null
      if (!stat || !minBoost) return alert('Enter stat and min boost')
      
      await fetch(API_BASE + '/api/alert-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: currentCharacter.id, stat, min_boost: minBoost, max_cost: maxCost })
      })
      
      document.getElementById('addGoalModal').classList.add('hidden')
      document.getElementById('goalStat').value = ''
      document.getElementById('goalMinBoost').value = ''
      document.getElementById('goalMaxCost').value = ''
      loadGoals()
    })

    document.getElementById('closeGoalBtn').addEventListener('click', () => {
      document.getElementById('addGoalModal').classList.add('hidden')
    })

    // My Matches Handler
    document.getElementById('myMatchesBtn').addEventListener('click', async () => {
      document.getElementById('myMatchesModal').classList.remove('hidden')
      const response = await fetch(API_BASE + '/api/my-matches?discord_id=' + currentUser.id)
      const data = await response.json()
      
      const available = document.getElementById('availableMatches')
      const sold = document.getElementById('soldMatches')
      
      if (data.available.length === 0) {
        available.innerHTML = '<p class="text-gray-500 text-sm">No matches available</p>'
      } else {
        available.innerHTML = data.available.map(item => \`
          <div class="p-3 border rounded">
            <div class="font-semibold">\${item.name}</div>
            <div class="text-sm text-gray-600">\${item.town} - \${item.shop} - \${item.cost.toLocaleString()} silvers</div>
            <div class="text-sm">\${JSON.parse(item.enhancives_json).map(e => \`+\${e.boost} \${e.ability}\`).join(', ')}</div>
          </div>
        \`).join('')
      }
      
      if (data.recentlySold.length === 0) {
        sold.innerHTML = '<p class="text-gray-500 text-sm">No recently sold items</p>'
      } else {
        sold.innerHTML = data.recentlySold.map(item => \`
          <div class="p-3 border rounded bg-gray-50">
            <div class="font-semibold">\${item.name}</div>
            <div class="text-sm text-gray-600">\${item.town} - \${item.shop} - \${item.cost.toLocaleString()} silvers</div>
            <div class="text-sm">\${JSON.parse(item.enhancives_json).map(e => \`+\${e.boost} \${e.ability}\`).join(', ')}</div>
            <div class="text-xs text-gray-500 mt-1">Sold: \${new Date(item.unavailable_since).toLocaleString()}</div>
          </div>
        \`).join('')
      }
    })

    document.getElementById('closeMatchesBtn').addEventListener('click', () => {
      document.getElementById('myMatchesModal').classList.add('hidden')
    })

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

app.get('/api/goal-sets', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const goalsQuery = await c.env.DB.prepare('SELECT DISTINCT goal_set_name FROM user_goals WHERE discord_id = ?').bind(discordId).all()
  const invQuery = await c.env.DB.prepare('SELECT DISTINCT goal_set_name FROM user_inventory WHERE discord_id = ?').bind(discordId).all()
  
  const sets = new Set()
  goalsQuery.results.forEach(r => sets.add(r.goal_set_name || 'Default'))
  invQuery.results.forEach(r => sets.add(r.goal_set_name || 'Default'))
  
  return c.json({ sets: [...sets] })
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
  
  if (!discord_id || !stat || min_boost === undefined || min_boost === null) {
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
