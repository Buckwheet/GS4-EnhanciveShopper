import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { scrapeEnhancives, getLastUpdated } from './scraper'
import { checkMatches } from './matcher'
import { sendDiscordDM } from './discord'
import { STAT_CAP, SKILL_CAP, SLOT_LIMITS } from './constants'
import { ranksToBonus } from './parser'
import { findDirectMatches, findNuggetOpportunities, findSwatchOpportunities, findSimpleSwaps } from './recommendation-engine'
import type { Env } from './types'

const ADMIN_DISCORD_ID = '411322973920821258'

const app = new Hono<{ Bindings: Env }>()

app.use('/*', cors())

function countSlotUsage(items: any[], slot: string, accountType: string): number {
  const limits = SLOT_LIMITS[accountType as keyof typeof SLOT_LIMITS]
  const _limit = limits ? (limits as Record<string, number>)[slot] || 1 : 1
  const count = items.filter(i => i.slot === slot).length
  return count
}

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
        <div id="userInfo" class="hidden flex items-center gap-3">
          <span class="text-gray-700">Welcome, <span id="username" class="font-bold"></span>! <span id="discordId" class="text-xs text-gray-500"></span></span>
          <button id="settingsBtn" class="text-gray-600 hover:text-gray-800" title="Settings">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </button>
          <button id="logoutBtn" class="text-sm text-gray-600 hover:text-gray-800">Logout</button>
        </div>
      </div>
    </div>
    
    <div class="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 class="text-2xl font-semibold mb-4">Search & Filter</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
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
      <div class="flex items-center justify-between">
        <label class="flex items-center cursor-pointer">
          <input type="checkbox" id="filterByGoals" class="mr-2">
          <span class="text-sm text-gray-700">Filter search automatically based on my goals</span>
        </label>
        <label class="flex items-center cursor-pointer">
          <input type="checkbox" id="filterPermanentOnly" class="mr-2">
          <span class="text-sm text-gray-700">Only show permanent items</span>
        </label>
        <label class="flex items-center cursor-pointer">
          <input type="checkbox" id="useAdvancedSkillCalc" class="mr-2">
          <span class="text-sm text-gray-700">Use advanced skill rank calculation</span>
        </label>
        <span id="goalFilterStatus" class="text-sm text-gray-500 hidden"></span>
      </div>
      </div>
    </div>

    <!-- Goals Section (only visible when logged in) -->
    <div id="goalsSection" class="hidden mb-6">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-semibold">My Alert Goals</h2>
          <div class="flex gap-2">
            <button id="myMatchesBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
              My Matches
            </button>
            <button id="aiChatBtn" class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded font-semibold">
              🤖 AI Assistant
            </button>
          </div>
        </div>
        
        <div class="flex gap-2 items-center mb-4">
            <label class="text-sm text-gray-600">Character:</label>
            <select id="characterSelector" class="border p-2 rounded">
              <option value="">No characters yet</option>
            </select>
            <button id="newCharacterBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm">+ New Character</button>
            <button id="manageCharacterBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">Manage Character</button>
            <span class="text-xs text-gray-500 italic ml-2">Note: Inventories are tied to character/set combinations</span>
          </div>
        
        <div class="flex gap-2 items-center mb-4">
            <label class="text-sm text-gray-600">Active Set:</label>
            <select id="goalSetSelector" class="border p-2 rounded">
              <option value="">No sets yet</option>
            </select>
            <button id="newSetBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm">+ New Set</button>
            <button id="editSetBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">Edit Set</button>
            <button id="deleteSetBtn" class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm">Delete Set</button>
          </div>
        </div>
        
        <div id="noCharacterWarning" class="mb-4 p-3 bg-red-50 border border-red-200 rounded hidden">
          <p class="text-red-700 text-sm font-semibold">⚠ Create a character first</p>
        </div>
        
        <div id="noSetWarning" class="mb-4 p-3 bg-red-50 border border-red-200 rounded hidden">
          <p class="text-red-700 text-sm font-semibold">⚠ Create a set for this character first</p>
        </div>
        
        <div class="mb-4">
          <button id="addGoalBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded" disabled>
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
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="ankle" class="mr-1"> ankle</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="arms" class="mr-1"> arms</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="back" class="mr-1"> back</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="belt" class="mr-1"> belt</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="chest" class="mr-1"> chest</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="cloak" class="mr-1"> cloak</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="ear" class="mr-1"> ear</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="ears" class="mr-1"> ears</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="elsewhere" class="mr-1"> elsewhere</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="feet" class="mr-1"> feet</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="finger" class="mr-1"> finger</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="front" class="mr-1"> front</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="hair" class="mr-1"> hair</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="hands" class="mr-1"> hands</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="head" class="mr-1"> head</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="leggings" class="mr-1"> leggings</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="legs" class="mr-1"> legs</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="neck" class="mr-1"> neck</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="pants" class="mr-1"> pants</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="pin" class="mr-1"> pin</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="shoulder" class="mr-1"> shoulder</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="shoulders" class="mr-1"> shoulders</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="socks" class="mr-1"> socks</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="torso" class="mr-1"> torso</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="undershirt" class="mr-1"> undershirt</label>
              <label class="flex items-center"><input type="checkbox" name="goalSlot" value="wrist" class="mr-1"> wrist</label>
            </div>
            <div class="mt-2">
              <label class="flex items-center">
                <input type="checkbox" name="goalSlot" value="nugget" id="goalNuggetCheckbox" class="mr-1"> nugget
              </label>
              <div id="nuggetPriceOption" class="ml-6 mt-1 hidden">
                <label class="flex items-center">
                  <input type="checkbox" id="goalNuggetPrice" class="mr-1">
                  <span class="text-sm text-gray-600">+25M price</span>
                </label>
              </div>
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
      
      <!-- Slot Usage Section -->
      <div id="slotUsageSection" class="hidden bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 class="text-2xl font-semibold mb-4">Slot Usage</h2>
        <div id="mainSlotUsage" class="text-sm"></div>
      </div>
      
      <!-- Summary Section -->
      <div id="summarySection" class="hidden bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 class="text-2xl font-semibold mb-4">Enhancive Summary</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-700 mb-3">Stats</h3>
            <div id="statsSummary" class="space-y-2 text-sm"></div>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-700 mb-3">Skills</h3>
            <div id="skillsSummary" class="space-y-2 text-sm"></div>
          </div>
        </div>
      </div>
      
      <!-- Create Set Modal -->
      <!-- Character Modals -->
      <div id="createCharacterModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 class="text-2xl font-semibold mb-4">Create New Character</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Character Name</label>
              <input type="text" id="newCharacterName" placeholder="e.g., Mejora" class="border p-2 rounded w-full">
            </div>
            <div class="flex gap-2">
              <button id="createCharacterConfirm" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex-1">Create</button>
              <button id="createCharacterCancel" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded flex-1">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Manage Character Modal with Tabs -->
      <div id="manageCharacterModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-semibold mb-4">Manage Character</h2>
          
          <!-- Tab Navigation -->
          <div class="flex border-b mb-4">
            <button id="tabCharInfo" class="px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-semibold">Character Info</button>
            <button id="tabCharData" class="px-4 py-2 text-gray-600 hover:text-blue-600">Character Data</button>
            <button id="tabInventory" class="px-4 py-2 text-gray-600 hover:text-blue-600">Inventory</button>
          </div>
          
          <!-- Tab Content: Character Info -->
          <div id="tabContentCharInfo" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Character Name</label>
              <input type="text" id="editCharacterName" class="border p-2 rounded w-full">
            </div>
            <div class="flex gap-2">
              <button id="editCharacterConfirm" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex-1">Save Name</button>
              <button id="deleteCharacterBtn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex-1">Delete Character</button>
            </div>
          </div>
          
          <!-- Tab Content: Character Data -->
          <div id="tabContentCharData" class="hidden space-y-4">
            <div id="currentCharSummary" class="mb-6"></div>
            
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
          
          <!-- Tab Content: Inventory -->
          <div id="tabContentInventory" class="hidden space-y-4">
            <div class="flex justify-end mb-2">
              <button onclick="document.getElementById('manageCharacterModal').classList.add('hidden')" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Close</button>
            </div>
            <div id="slotUsageDisplay" class="mb-4 p-3 bg-blue-50 rounded text-sm"></div>
            
            <div class="mb-4">
              <button id="addItemBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mr-2">+ Add Enhancive Item</button>
              <button id="bulkImportBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2">Bulk Import</button>
              <button id="yamlImportBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded mr-2">YAML Import File</button>
              <a href="/enh_export.lic" download class="inline-block bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded mr-2">Download Lich Script</a>
              <button id="copyInventoryBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded mr-2">Copy from Set</button>
              <button id="deleteAllInventoryBtn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Delete All</button>
            </div>
            
            <input type="file" id="yamlFileInput" accept=".yaml,.yml" class="hidden">
            
            <div id="copyInventoryForm" class="hidden mb-6 p-4 border rounded bg-purple-50">
              <h3 class="font-semibold mb-3">Copy Inventory from Another Set</h3>
              <p class="text-sm text-gray-600 mb-3">Select a set to copy inventory from:</p>
              <select id="copySourceSet" class="border p-2 rounded w-full mb-3">
                <option value="">Select a set...</option>
              </select>
              <div class="flex gap-2">
                <button id="confirmCopyInventory" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">Copy Items</button>
                <button id="cancelCopyInventory" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Cancel</button>
              </div>
            </div>
            
            <div id="bulkImportForm" class="hidden mb-6 p-4 border rounded bg-gray-50">
              <h3 class="font-semibold mb-3">Bulk Import Inventory</h3>
              <p class="text-sm text-gray-600 mb-3">Paste your inventory data below:</p>
              
              <div class="mb-4">
                <label class="block font-medium mb-1">Inventory Enhancive Detail</label>
                <textarea id="bulkEnhanciveDetail" rows="10" class="border p-2 rounded w-full font-mono text-sm" placeholder="Paste inventory enhancive detail here..."></textarea>
              </div>
              
              <div class="mb-4">
                <label class="block font-medium mb-1">Inventory Location</label>
                <textarea id="bulkInventoryLocation" rows="10" class="border p-2 rounded w-full font-mono text-sm" placeholder="Paste inventory location here..."></textarea>
              </div>
              
              <div class="flex gap-2">
                <button id="processBulkImport" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Process Import</button>
                <button id="cancelBulkImport" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Cancel</button>
              </div>
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
          
          <div class="flex justify-end mt-4">
            <button id="manageCharacterClose" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Close</button>
          </div>
        </div>
      </div>

      <!-- Set Modals -->
      <div id="createSetModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 class="text-2xl font-semibold mb-4">Create New Set</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Set Name</label>
              <input type="text" id="newSetName" placeholder="e.g., Hunting, PvP" class="border p-2 rounded w-full">
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

      <div id="editSetModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 class="text-2xl font-semibold mb-4">Edit Set</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Set Name</label>
              <input type="text" id="editSetName" class="border p-2 rounded w-full">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Account Type</label>
              <select id="editSetAccountType" class="border p-2 rounded w-full">
                <option value="F2P">F2P / Standard</option>
                <option value="Premium">Premium</option>
                <option value="Platinum">Platinum</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button id="editSetConfirm" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex-1">Save</button>
              <button id="editSetCancel" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded flex-1">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- My Matches Modal -->
      <div id="myMatchesModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-semibold">My Matches</h2>
            <div class="flex gap-2 items-center">
              <button id="recalculateBtn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm hidden">Recalculate</button>
              <button id="closeMatchesBtn" class="text-gray-600 hover:text-gray-800 text-2xl">&times;</button>
            </div>
          </div>
          
          <!-- Match Type Tabs -->
          <div class="flex border-b mb-4">
            <button class="match-tab px-4 py-2 font-medium border-b-2 border-blue-600 text-blue-600" data-tab="matchesAvailable">Available</button>
            <button class="match-tab px-4 py-2 font-medium text-gray-500 hover:text-gray-700" data-tab="matchesSold">Sold</button>
            <button class="match-tab px-4 py-2 font-medium text-gray-500 hover:text-gray-700" data-tab="recDirect">Direct</button>
            <button class="match-tab px-4 py-2 font-medium text-gray-500 hover:text-gray-700" data-tab="recNuggets">Nuggets</button>
            <button class="match-tab px-4 py-2 font-medium text-gray-500 hover:text-gray-700" data-tab="recSwatches">Swatches</button>
            <button class="match-tab px-4 py-2 font-medium text-gray-500 hover:text-gray-700" data-tab="recSwaps">Swaps</button>
          </div>
          
          <div id="matchesAvailable" class="match-panel">
            <h3 class="text-lg font-semibold mb-2 text-green-700">Available Now</h3>
            <div id="availableMatches" class="space-y-2"></div>
          </div>
          
          <div id="matchesSold" class="match-panel hidden">
            <h3 class="text-lg font-semibold mb-2 text-gray-600">Recently Sold (Last 72 Hours)</h3>
            <div id="soldMatches" class="space-y-2"></div>
          </div>
          
          <div id="recDirect" class="match-panel hidden">
            <h3 class="text-lg font-semibold mb-2 text-blue-700">Direct Matches</h3>
            <p class="text-sm text-gray-500 mb-2">Items that fit your goals and available slots</p>
            <div id="directRecList" class="space-y-2"></div>
          </div>
          
          <div id="recNuggets" class="match-panel hidden">
            <h3 class="text-lg font-semibold mb-2 text-purple-700">Nugget Opportunities</h3>
            <p class="text-sm text-gray-500 mb-2">Non-wearable items worth converting (+25M silver)</p>
            <div id="nuggetRecList" class="space-y-2"></div>
          </div>
          
          <div id="recSwatches" class="match-panel hidden">
            <h3 class="text-lg font-semibold mb-2 text-orange-700">Swatch Opportunities</h3>
            <p class="text-sm text-gray-500 mb-2">Wrong-slot items worth moving (+25M silver)</p>
            <div id="swatchRecList" class="space-y-2"></div>
          </div>
          
          <div id="recSwaps" class="match-panel hidden">
            <h3 class="text-lg font-semibold mb-2 text-red-700">Inventory Swaps</h3>
            <p class="text-sm text-gray-500 mb-2">Replace existing items with better alternatives</p>
            <div id="swapRecList" class="space-y-2"></div>
          </div>
        </div>
      </div>
      
      <!-- AI Chat Modal -->
      <div id="aiChatModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-semibold">🤖 AI Assistant</h2>
            <div class="flex gap-2">
              <button id="clearChatBtn" class="text-gray-600 hover:text-gray-800 text-sm">Clear</button>
              <button id="closeAiChatBtn" class="text-gray-600 hover:text-gray-800 text-2xl">&times;</button>
            </div>
          </div>
          
          <div class="mb-3 flex gap-2 flex-wrap">
            <button class="example-query bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm">What are my goals?</button>
            <button class="example-query bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm">What do I need to cap?</button>
            <button class="example-query bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm">Explain stat bonuses</button>
          </div>
          
          <div id="chatMessages" class="flex-1 overflow-y-auto mb-4 space-y-2 min-h-[400px]"></div>
          
          <div class="flex gap-2">
            <input id="chatInput" type="text" placeholder="Ask me anything..." class="flex-1 border rounded px-3 py-2" />
            <button id="sendChatBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">Send</button>
          </div>
        </div>
      </div>
      
      <!-- Settings Modal -->
      <div id="settingsModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-semibold">Settings</h2>
            <button id="closeSettingsBtn" class="text-gray-600 hover:text-gray-800 text-2xl">&times;</button>
          </div>
          
          <div class="space-y-4">
            <label class="flex items-center cursor-pointer">
              <input type="checkbox" id="enableDiscordNotifications" class="mr-3">
              <div>
                <div class="font-medium">Discord Notifications</div>
                <div class="text-sm text-gray-600">Receive Discord DMs when new items match your goals</div>
              </div>
            </label>
          </div>
          
          <div class="mt-6 flex justify-end">
            <button id="saveSettingsBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Save</button>
          </div>
        </div>
      </div>
      
      <!-- Set Modals -->
    <div id="editInvModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 class="text-xl font-semibold mb-4">Edit Item</h2>
        <div class="mb-3">
          <label class="block font-medium mb-1">Item Name</label>
          <input type="text" id="editItemName" class="border p-2 rounded w-full" readonly>
        </div>
        <div class="mb-3">
          <label class="block font-medium mb-1">Slot</label>
          <select id="editItemSlot" class="border p-2 rounded w-full">
            <option value="pin">Pin</option>
            <option value="head">Head</option>
            <option value="hair">Hair</option>
            <option value="ear">Ear</option>
            <option value="ears">Ears</option>
            <option value="neck">Neck</option>
            <option value="front">Front</option>
            <option value="chest">Chest</option>
            <option value="undershirt">Undershirt</option>
            <option value="arms">Arms</option>
            <option value="wrist">Wrist</option>
            <option value="hands">Hands</option>
            <option value="finger">Finger</option>
            <option value="waist">Waist</option>
            <option value="belt">Belt</option>
            <option value="leggings">Leggings</option>
            <option value="legs">Legs</option>
            <option value="ankle">Ankle</option>
            <option value="feet">Feet</option>
            <option value="elsewhere">Elsewhere</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="flex items-center">
            <input type="checkbox" id="editItemPermanent" class="mr-2">
            <span>Permanent (unchecked = temporary/crumbles)</span>
          </label>
        </div>
        <div class="flex gap-2">
          <button id="saveEditItem" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Save</button>
          <button id="cancelEditItem" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Cancel</button>
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
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-700" onclick="sortItems('name')">Name ↕</th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-700" onclick="sortItems('town')">Town ↕</th>
            <th class="px-4 py-3 text-left">Shop</th>
            <th class="px-4 py-3 text-right cursor-pointer hover:bg-gray-700" onclick="sortItems('cost')">Cost ↕</th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-700" onclick="sortItems('slot')">Slot ↕</th>
            <th class="px-4 py-3 text-right cursor-pointer hover:bg-gray-700" onclick="sortItems('matchSum')">Match Sum ↕</th>
            <th class="px-4 py-3 text-right cursor-pointer hover:bg-gray-700" onclick="sortItems('totalSum')">Total Sum ↕</th>
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
    let currentCharacterId = null
    let currentCharacterName = ''
    let currentCharacterSkills = null
    let currentSetId = null
    let currentSetName = 'Default'
    let currentGoalSet = 'Default'
    let allKnownSets = new Set(['Default'])
    let userGoals = []
    let includeNuggetPrice = false
    let includeSwatchPrice = false // DISABLED: Swatch feature not yet implemented
    let filterByGoalsEnabled = false
    let filterPermanentOnly = false
    let useAdvancedSkillCalc = false
    let chatHistory = []

    // Helper to safely add event listeners
    function addListener(id, event, handler) {
      const el = document.getElementById(id)
      if (el) el.addEventListener(event, handler)
      else console.warn('Element not found:', id)
    }

    // Location swatch slot change data
    // Source: https://gswiki.play.net/Item_worn_location_change
    const SWATCH_SLOTS = {
      'pin': { num: 1, baseNoun: 'pin', wood: 'pin', metal: 'pin', container: null },
      'back': { num: 2, baseNoun: 'cape', wood: null, metal: null, container: 'backpack' },
      'waist': { num: 3, baseNoun: 'belt', wood: 'belt', metal: 'belt', container: 'belt' },
      'head': { num: 4, baseNoun: 'headband', wood: 'crown', metal: 'crown', container: 'hat' },
      'shoulder_slung': { num: 5, baseNoun: 'sash', wood: null, metal: 'pauldron', container: 'satchel' },
      'shoulders_draped': { num: 6, baseNoun: 'shawl', wood: null, metal: 'pauldrons', container: 'cloak' },
      'legs_attached': { num: 7, baseNoun: 'pants', wood: null, metal: null, container: 'pants' },
      'chest': { num: 8, baseNoun: 'doublet', wood: null, metal: null, container: 'doublet' },
      'wrist': { num: 9, baseNoun: 'bracelet', wood: 'bracelet', metal: 'bracelet', container: null },
      'fingers': { num: 10, baseNoun: 'ring', wood: 'ring', metal: 'ring', container: null },
      'feet_on': { num: 11, baseNoun: 'shoes', wood: null, metal: null, container: 'shoes' },
      'neck': { num: 12, baseNoun: 'necklace', wood: 'necklace', metal: 'necklace', container: 'neck pouch' },
      'belt': { num: 13, baseNoun: 'buckle', wood: 'buckle', metal: 'buckle', container: 'belt pack' },
      'arms': { num: 14, baseNoun: 'armbands', wood: 'armbands', metal: 'armbands', container: 'arm wraps' },
      'legs_pulled': { num: 15, baseNoun: 'leg wraps', wood: 'leg braces', metal: 'leg braces', container: 'thigh-sheath' },
      'single_ear': { num: 16, baseNoun: 'earring', wood: 'earring', metal: 'earring', container: null },
      'both_ears': { num: 17, baseNoun: 'earrings', wood: 'earrings', metal: 'earrings', container: null },
      'ankle': { num: 18, baseNoun: 'anklet', wood: 'anklet', metal: 'anklet', container: 'ankle pouch' },
      'front': { num: 19, baseNoun: 'tabard', wood: 'pectoral', metal: 'pectoral', container: 'tabard' },
      'hands': { num: 20, baseNoun: 'gloves', wood: 'handflowers', metal: 'handflowers', container: 'gloves' },
      'feet_slipped': { num: 21, baseNoun: 'socks', wood: null, metal: null, container: 'socks' },
      'hair': { num: 22, baseNoun: 'hairtie', wood: 'barrette', metal: 'barrette', container: null },
      'chest_slipped': { num: 23, baseNoun: 'undershirt', wood: null, metal: null, container: null }
    }

    // Check if a slot can be swatched
    function isSwatchEligible(slot) {
      return slot in SWATCH_SLOTS && slot !== 'locus'
    }

    // Get all possible swatch target slots for an item
    function getSwatchTargets(currentSlot) {
      if (!isSwatchEligible(currentSlot)) return []
      
      // Special case: greaves can only swap between arms and legs_pulled
      if (currentSlot === 'arms') return ['legs_pulled']
      if (currentSlot === 'legs_pulled') return ['arms']
      
      // All other slots can swap to any other swatch-eligible slot
      return Object.keys(SWATCH_SLOTS).filter(s => s !== currentSlot && s !== 'locus')
    }

    function addChatMessage(text, isUser) {
      const div = document.createElement('div')
      div.className = 'p-3 rounded ' + (isUser ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8')
      div.innerHTML = text.replace(/\b(neck|finger|wrist|head|ear|waist|arms|legs|feet|shoulder)\b/gi, '<span class="font-semibold text-blue-600">$1</span>')
      document.getElementById('chatMessages').appendChild(div)
      div.scrollIntoView({ behavior: 'smooth' })
    }

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
      document.getElementById('discordId').textContent = '(ID: ' + currentUser.id + ')'
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

    document.getElementById('settingsBtn').addEventListener('click', async () => {
      const response = await fetch(API_BASE + '/api/user/settings?discord_id=' + currentUser.id)
      const data = await response.json()
      document.getElementById('enableDiscordNotifications').checked = data.notifications_enabled
      document.getElementById('settingsModal').classList.remove('hidden')
    })

    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.add('hidden')
    })

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
      const enabled = document.getElementById('enableDiscordNotifications').checked
      await fetch(API_BASE + '/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_id: currentUser.id,
          notifications_enabled: enabled
        })
      })
      document.getElementById('settingsModal').classList.add('hidden')
      alert('Settings saved!')
    })

    window.addEventListener('message', (event) => {
      if (event.data.type === 'discord_auth') {
        currentUser = event.data.user
        localStorage.setItem('discord_user', JSON.stringify(currentUser))
        showUserInfo()
      }
    })

    // Legacy functions - no longer used with new hierarchy
    // Kept for reference but should not be called
    /*
    async function getCurrentSetId() {
      if (!currentUser || !currentGoalSet) return null
      const response = await fetch(API_BASE + '/api/character-sets?discord_id=' + currentUser.id)
      const data = await response.json()
      const currentSet = data.sets.find(s => s.set_name === currentGoalSet)
      return currentSet?.id || null
    }

    async function loadGoals() {
      if (!currentUser) return
      
      // Get all character sets
      const setsResponse = await fetch(API_BASE + '/api/character-sets?discord_id=' + currentUser.id)
      const setsData = await setsResponse.json()
      
      // Update known sets
      allKnownSets.clear()
      setsData.sets.forEach(s => allKnownSets.add(s.set_name))
      if (allKnownSets.size === 0) allKnownSets.add('Default')
      
      // Save to localStorage
      localStorage.setItem('knownSets_' + currentUser.id, JSON.stringify([...allKnownSets]))
      
      // If current set doesn't exist, reset to first available
      if (!allKnownSets.has(currentGoalSet)) {
        currentGoalSet = [...allKnownSets][0]
      }
      
      // Find current set data
      const currentSet = setsData.sets.find(s => s.set_name === currentGoalSet)
      
      const setSelector = document.getElementById('goalSetSelector')
      if (setsData.sets.length === 0) {
        setSelector.innerHTML = '<option value="">No sets - create one to get started</option>'
        document.getElementById('goalsList').innerHTML = '<p class="text-gray-500">No sets yet. Create one to get started!</p>'
        return
      }
      
      setSelector.innerHTML = setsData.sets.map(s => \`<option value="\${s.set_name}" data-set-id="\${s.id}" data-account-type="\${s.account_type}" \${s.set_name === currentGoalSet ? 'selected' : ''}>\${s.set_name} (\${s.account_type})</option>\`).join('')
      
      // Load goals for current set
      if (!currentSet) {
        document.getElementById('goalsList').innerHTML = '<p class="text-gray-500">Set not found. Please select another set.</p>'
        return
      }
      
      const goalsResponse = await fetch(API_BASE + '/api/character-sets/' + currentSet.id + '/goals')
      const goalsData = await goalsResponse.json()
      
      const goalsList = document.getElementById('goalsList')
      if (goalsData.goals.length === 0) {
        goalsList.innerHTML = '<p class="text-gray-500">No goals in this set. Add one to get started!</p>'
        return
      }

      goalsList.innerHTML = goalsData.goals.map(goal => \`
        <div class="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
          <div>
            <span class="font-semibold">\${goal.stat}</span> 
            <span class="text-gray-600">+\${goal.min_boost} or higher</span>
            \${goal.max_cost ? \`<span class="text-sm text-gray-500">• Max: \${goal.max_cost.toLocaleString()}</span>\` : ''}
            \${goal.preferred_slots ? \`<span class="text-sm text-gray-500">• Slots: \${goal.preferred_slots}</span>\` : ''}
          </div>
          <div class="flex gap-2">
            <button class="text-blue-600 hover:text-blue-800 text-sm" onclick="editGoal(\${goal.id})">Edit</button>
            <button class="text-red-600 hover:text-red-800 text-sm" onclick="deleteGoal(\${goal.id})">Delete</button>
          </div>
        </div>
      \`).join('')
    }
    */

    // Character Management
    async function loadCharacters() {
      if (!currentUser) return
      
      const response = await fetch(API_BASE + '/api/characters?discord_id=' + currentUser.id)
      const data = await response.json()
      
      const selector = document.getElementById('characterSelector')
      selector.innerHTML = ''
      
      if (data.characters.length === 0) {
        selector.innerHTML = '<option value="">No characters yet</option>'
        document.getElementById('noCharacterWarning').classList.remove('hidden')
        currentCharacterId = null
        currentCharacterName = ''
        currentCharacterSkills = null
      } else {
        document.getElementById('noCharacterWarning').classList.add('hidden')
        data.characters.forEach(char => {
          const opt = document.createElement('option')
          opt.value = char.id
          opt.textContent = char.character_name
          selector.appendChild(opt)
        })
        
        if (!currentCharacterId && data.characters.length > 0) {
          currentCharacterId = data.characters[0].id
          currentCharacterName = data.characters[0].character_name
          const char = data.characters[0]
          currentCharacterSkills = char && char.skill_ranks ? JSON.parse(char.skill_ranks) : null
        }
        
        selector.value = currentCharacterId
      }
      
      await loadSets()
    }

    async function loadSets() {
      if (!currentCharacterId) {
        document.getElementById('goalSetSelector').innerHTML = '<option value="">No sets yet</option>'
        document.getElementById('noSetWarning').classList.remove('hidden')
        return
      }
      
      const response = await fetch(API_BASE + '/api/characters/' + currentCharacterId + '/sets')
      const data = await response.json()
      
      const selector = document.getElementById('goalSetSelector')
      selector.innerHTML = ''
      
      if (data.sets.length === 0) {
        selector.innerHTML = '<option value="">No sets yet</option>'
        document.getElementById('noSetWarning').classList.remove('hidden')
        currentSetId = null
        currentSetName = ''
        document.getElementById('addGoalBtn').disabled = true
        document.getElementById('addItemBtn').disabled = true
      } else {
        document.getElementById('noSetWarning').classList.add('hidden')
        document.getElementById('addGoalBtn').disabled = false
        document.getElementById('addItemBtn').disabled = false
        data.sets.forEach(set => {
          const opt = document.createElement('option')
          opt.value = set.id
          opt.textContent = set.set_name + ' (' + set.account_type + ')'
          selector.appendChild(opt)
        })
        
        if (!currentSetId && data.sets.length > 0) {
          currentSetId = data.sets[0].id
          currentSetName = data.sets[0].set_name
        }
        
        selector.value = currentSetId
      }
      
      await loadGoalsForSet()
      await loadInventory()
      await loadSlotUsage()
      await loadSummary()
      
      // Refresh item filter if filtering by goals is enabled
      if (filterByGoalsEnabled) {
        filterItems()
      }
    }

    async function loadGoalsForSet() {
      if (!currentSetId) return
      
      const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/goals')
      const data = await response.json()
      userGoals = data.goals
      
      const list = document.getElementById('goalsList')
      if (data.goals.length === 0) {
        list.innerHTML = '<p class="text-gray-500">No goals yet. Add one above!</p>'
      } else {
        list.innerHTML = data.goals.map(g => {
          const slots = g.preferred_slots ? ' (slots: ' + g.preferred_slots + ')' : ''
          const cost = g.max_cost ? ' under ' + g.max_cost.toLocaleString() + ' silvers' : ''
          return '<div class="flex justify-between items-center p-2 border-b"><span>' + g.stat + ' +' + g.min_boost + cost + slots + '</span><div><button onclick="editGoal(' + g.id + ')" class="text-blue-600 hover:underline mr-2">Edit</button><button onclick="deleteGoal(' + g.id + ')" class="text-red-600 hover:underline">Delete</button></div></div>'
        }).join('')
      }
    }

    document.getElementById('characterSelector').addEventListener('change', async (e) => {
      currentCharacterId = e.target.value
      const opt = e.target.selectedOptions[0]
      currentCharacterName = opt ? opt.textContent : ''
      
      // Load character skills
      if (currentCharacterId) {
        const res = await fetch(API_BASE + '/api/characters?discord_id=' + currentUser.id)
        const data = await res.json()
        const char = data.characters.find(c => c.id == currentCharacterId)
        currentCharacterSkills = char && char.skill_ranks ? JSON.parse(char.skill_ranks) : null
      } else {
        currentCharacterSkills = null
      }
      
      await loadSets()
    })

    document.getElementById('newCharacterBtn').addEventListener('click', () => {
      document.getElementById('createCharacterModal').classList.remove('hidden')
    })

    document.getElementById('createCharacterCancel').addEventListener('click', () => {
      document.getElementById('createCharacterModal').classList.add('hidden')
    })

    document.getElementById('createCharacterConfirm').addEventListener('click', async () => {
      const name = document.getElementById('newCharacterName').value.trim()
      
      if (!name) {
        alert('Please enter a character name')
        return
      }
      
      const response = await fetch(API_BASE + '/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_id: currentUser.id,
          character_name: name
        })
      })
      
      if (!response.ok) {
        alert('Failed to create character')
        return
      }
      
      const result = await response.json()
      currentCharacterId = result.id
      currentCharacterName = name
      
      document.getElementById('createCharacterModal').classList.add('hidden')
      document.getElementById('newCharacterName').value = ''
      
      await loadCharacters()
    })

    document.getElementById('editCharacterConfirm').addEventListener('click', async () => {
      const name = document.getElementById('editCharacterName').value.trim()
      
      if (!name) {
        alert('Please enter a character name')
        return
      }
      
      await fetch(API_BASE + '/api/characters/' + currentCharacterId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: name,
          base_stats: null,
          skill_ranks: null
        })
      })
      
      currentCharacterName = name
      await loadCharacters()
    })

    document.getElementById('deleteCharacterBtn').addEventListener('click', async () => {
      if (!currentCharacterId) return
      
      const confirmed = confirm('Delete "' + currentCharacterName + '" and all its sets? This cannot be undone.')
      if (!confirmed) return
      
      await fetch(API_BASE + '/api/characters/' + currentCharacterId, { method: 'DELETE' })
      
      currentCharacterId = null
      currentCharacterName = ''
      await loadCharacters()
    })

    // Manage Character Modal - Tab Switching
    document.getElementById('manageCharacterBtn').addEventListener('click', async () => {
      if (!currentCharacterId) return
      
      // Load character data
      const response = await fetch(API_BASE + '/api/characters?discord_id=' + currentUser.id)
      const data = await response.json()
      const char = data.characters.find(c => c.id == currentCharacterId)
      
      if (char) {
        document.getElementById('editCharacterName').value = char.character_name
        document.getElementById('manageCharacterModal').classList.remove('hidden')
        
        // Show Character Info tab by default
        switchToTab('CharInfo')
      }
    })

    document.getElementById('manageCharacterClose').addEventListener('click', () => {
      document.getElementById('manageCharacterModal').classList.add('hidden')
      // Refresh displays after closing
      loadSlotUsage()
      loadSummary()
    })

    function switchToTab(tabName) {
      // Hide all tabs
      document.getElementById('tabContentCharInfo').classList.add('hidden')
      document.getElementById('tabContentCharData').classList.add('hidden')
      document.getElementById('tabContentInventory').classList.add('hidden')
      
      // Reset all tab buttons
      document.getElementById('tabCharInfo').className = 'px-4 py-2 text-gray-600 hover:text-blue-600'
      document.getElementById('tabCharData').className = 'px-4 py-2 text-gray-600 hover:text-blue-600'
      document.getElementById('tabInventory').className = 'px-4 py-2 text-gray-600 hover:text-blue-600'
      
      // Show selected tab
      document.getElementById('tabContent' + tabName).classList.remove('hidden')
      document.getElementById('tab' + tabName).className = 'px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-semibold'
      
      // Load data for specific tabs
      if (tabName === 'CharData') {
        loadCharacterDataTab()
      } else if (tabName === 'Inventory') {
        loadInventoryTab()
      }
    }

    document.getElementById('tabCharInfo').addEventListener('click', () => switchToTab('CharInfo'))
    document.getElementById('tabCharData').addEventListener('click', () => switchToTab('CharData'))
    document.getElementById('tabInventory').addEventListener('click', () => switchToTab('Inventory'))

    async function loadCharacterDataTab() {
      const response = await fetch(API_BASE + '/api/characters?discord_id=' + currentUser.id)
      const data = await response.json()
      const char = data.characters.find(c => c.id == currentCharacterId)
      
      if (char && char.base_stats) {
        document.getElementById('currentCharSummary').innerHTML = '<div class="p-3 bg-green-50 rounded"><strong>Character Data Saved</strong><br>Stats and skills are on file.</div>'
      } else {
        document.getElementById('currentCharSummary').innerHTML = '<div class="p-3 bg-yellow-50 rounded"><strong>No Character Data</strong><br>Please paste your stats and skills below.</div>'
      }
    }

    async function loadInventoryTab() {
      await loadInventory()
    }

    document.getElementById('goalSetSelector').addEventListener('change', async (e) => {
      currentSetId = e.target.value
      const opt = e.target.selectedOptions[0]
      currentSetName = opt ? opt.textContent.split(' (')[0] : ''
      await loadGoalsForSet()
      await loadInventory()
      await loadSlotUsage()
      await loadSummary()
      
      // Refresh item filter if filtering by goals is enabled
      if (filterByGoalsEnabled) {
        filterItems()
      }
    })

    // Set Management
    document.getElementById('newSetBtn').addEventListener('click', () => {
      if (!currentCharacterId) {
        alert('Please select a character first')
        return
      }
      document.getElementById('createSetModal').classList.remove('hidden')
    })

    document.getElementById('createSetCancel').addEventListener('click', () => {
      document.getElementById('createSetModal').classList.add('hidden')
    })

    document.getElementById('createSetConfirm').addEventListener('click', async () => {
      const setName = document.getElementById('newSetName').value.trim()
      const accountType = document.getElementById('newSetAccountType').value
      
      if (!setName) {
        alert('Please enter a set name')
        return
      }
      
      if (!currentCharacterId) {
        alert('Please select a character first')
        return
      }
      
      const response = await fetch(API_BASE + '/api/characters/' + currentCharacterId + '/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set_name: setName,
          account_type: accountType
        })
      })
      
      if (!response.ok) {
        alert('Failed to create set')
        return
      }
      
      const result = await response.json()
      currentSetId = result.id
      currentSetName = setName
      
      document.getElementById('createSetModal').classList.add('hidden')
      document.getElementById('newSetName').value = ''
      document.getElementById('newSetAccountType').value = 'F2P'
      
      await loadSets()
    })

    document.getElementById('deleteSetBtn').addEventListener('click', async () => {
      if (!currentSetId) return
      
      const confirmed = confirm('Delete "' + currentSetName + '" and all its goals? This cannot be undone.')
      if (!confirmed) return
      
      await fetch(API_BASE + '/api/sets/' + currentSetId, { method: 'DELETE' })
      
      currentSetId = null
      currentSetName = ''
      await loadSets()
    })

    document.getElementById('editSetBtn').addEventListener('click', async () => {
      if (!currentSetId) return
      
      const response = await fetch(API_BASE + '/api/characters/' + currentCharacterId + '/sets')
      const data = await response.json()
      const activeSet = data.sets.find(s => s.id == currentSetId)
      
      if (!activeSet) return
      
      document.getElementById('editSetName').value = activeSet.set_name
      document.getElementById('editSetAccountType').value = activeSet.account_type || 'F2P'
      document.getElementById('editSetModal').classList.remove('hidden')
    })

    document.getElementById('editSetCancel').addEventListener('click', () => {
      document.getElementById('editSetModal').classList.add('hidden')
    })

    document.getElementById('editSetConfirm').addEventListener('click', async () => {
      const newName = document.getElementById('editSetName').value.trim()
      const newAccountType = document.getElementById('editSetAccountType').value
      
      if (!newName || !currentSetId) {
        alert('Please enter a set name')
        return
      }
      
      await fetch(API_BASE + '/api/sets/' + currentSetId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set_name: newName,
          account_type: newAccountType
        })
      })
      
      currentSetName = newName
      
      await loadSets()
      await loadSlotUsage()
      
      document.getElementById('editSetModal').classList.add('hidden')
    })

    window.deleteGoal = async function(id) {
      if (!confirm('Delete this goal?')) return
      await fetch(API_BASE + '/api/set-goals/' + id, { method: 'DELETE' })
      await loadGoalsForSet()
      
      // Refresh item filter if filtering by goals is enabled
      if (filterByGoalsEnabled) {
        const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/goals')
        const data = await response.json()
        userGoals = data.goals || []
        filterItems()
      }
    }

    let editingGoalId = null

    window.editGoal = async function(id) {
      const response = await fetch(API_BASE + '/api/set-goals/' + id)
      const data = await response.json()
      const goal = data.goal
      
      if (!goal) return
      
      editingGoalId = id
      document.getElementById('goalStat').value = goal.stat
      document.getElementById('goalBoost').value = goal.min_boost
      document.getElementById('goalMaxCost').value = goal.max_cost || ''
      document.getElementById('goalNuggetPrice').checked = goal.include_nugget_price === 1
      
      if (goal.preferred_slots) {
        const slots = goal.preferred_slots.split(',').map(s => s.trim())
        document.querySelectorAll('input[name="goalSlot"]').forEach(cb => {
          cb.checked = slots.includes(cb.value)
        })
        if (slots.includes('nugget')) {
          document.getElementById('nuggetPriceOption').classList.remove('hidden')
        } else {
          document.getElementById('nuggetPriceOption').classList.add('hidden')
        }
      } else {
        document.querySelectorAll('input[name="goalSlot"]').forEach(cb => cb.checked = false)
        document.getElementById('nuggetPriceOption').classList.add('hidden')
      }
      
      document.getElementById('addGoalForm').classList.remove('hidden')
      document.getElementById('saveGoalBtn').textContent = 'Update Goal'
    }

    let parsedStatsData = null
    let parsedSkillsData = null
    let parsedItemData = null

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
      
      if (!currentCharacterId) {
        alert('No character selected')
        return
      }
      
      const body = {}
      if (parsedStatsData) body.base_stats = JSON.stringify(parsedStatsData)
      if (parsedSkillsData) body.skill_ranks = JSON.stringify(parsedSkillsData)
      
      await fetch(API_BASE + '/api/characters/' + currentCharacterId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      alert('Character data saved!')
      document.getElementById('manageCharModal').classList.add('hidden')
    })

    document.getElementById('cancelEditItem').addEventListener('click', () => {
      document.getElementById('editInvModal').classList.add('hidden')
    })
    
    document.getElementById('saveEditItem').addEventListener('click', async () => {
      const itemId = document.getElementById('editInvModal').dataset.itemId
      const slot = document.getElementById('editItemSlot').value
      const isPermanent = document.getElementById('editItemPermanent').checked
      
      const response = await fetch(API_BASE + '/api/set-inventory/' + itemId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: slot, is_permanent: isPermanent })
      })
      
      if (response.ok) {
        document.getElementById('editInvModal').classList.add('hidden')
        loadInventory()
        loadSlotUsage()
        loadSummary()
      } else {
        alert('Error updating item')
      }
    })

    document.getElementById('addItemBtn').addEventListener('click', () => {
      document.getElementById('addItemForm').classList.remove('hidden')
      document.getElementById('bulkImportForm').classList.add('hidden')
    })
    
    document.getElementById('yamlImportBtn').addEventListener('click', () => {
      document.getElementById('yamlFileInput').click()
    })
    
    document.getElementById('yamlFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return
      
      const text = await file.text()
      await processYamlImport(text)
      e.target.value = ''
    })
    
    document.getElementById('bulkImportBtn').addEventListener('click', () => {
      document.getElementById('bulkImportForm').classList.remove('hidden')
      document.getElementById('addItemForm').classList.add('hidden')
      document.getElementById('copyInventoryForm').classList.add('hidden')
    })
    
    document.getElementById('copyInventoryBtn').addEventListener('click', async () => {
      if (!currentCharacterId) {
        alert('Please select a character first')
        return
      }
      
      const response = await fetch(API_BASE + '/api/characters/' + currentCharacterId + '/sets')
      const data = await response.json()
      const select = document.getElementById('copySourceSet')
      select.innerHTML = '<option value="">Select a set...</option>' + data.sets.map(s => 
        '<option value="' + s.id + '">' + s.set_name + ' (' + s.account_type + ')</option>'
      ).join('')
      
      document.getElementById('copyInventoryForm').classList.remove('hidden')
      document.getElementById('addItemForm').classList.add('hidden')
      document.getElementById('bulkImportForm').classList.add('hidden')
    })
    
    document.getElementById('cancelCopyInventory').addEventListener('click', () => {
      document.getElementById('copyInventoryForm').classList.add('hidden')
    })
    
    document.getElementById('confirmCopyInventory').addEventListener('click', async () => {
      const sourceSetId = document.getElementById('copySourceSet').value
      if (!sourceSetId) {
        alert('Please select a source set')
        return
      }
      
      if (sourceSetId === currentSetId) {
        alert('Cannot copy from the same set')
        return
      }
      
      if (!confirm('Copy all items from selected set? This will add to existing inventory.')) return
      
      try {
        const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/inventory/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_set_id: sourceSetId })
        })
        
        if (response.ok) {
          const result = await response.json()
          alert('Copied ' + result.count + ' items successfully')
          document.getElementById('copyInventoryForm').classList.add('hidden')
          loadInventory()
          loadSlotUsage()
          loadSummary()
        } else {
          alert('Error copying inventory')
        }
      } catch (error) {
        console.error('Copy error:', error)
        alert('Error copying inventory')
      }
    })
    
    document.getElementById('deleteAllInventoryBtn').addEventListener('click', async () => {
      if (!currentSetId) {
        alert('Please select a set first')
        return
      }
      
      if (!confirm('Delete ALL items from this inventory? This cannot be undone!')) return
      
      try {
        const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/inventory', {
          method: 'DELETE'
        })
        
        if (response.ok) {
          alert('All inventory items deleted')
          loadInventory()
        } else {
          alert('Error deleting inventory')
        }
      } catch (error) {
        console.error('Delete all error:', error)
        alert('Error deleting inventory')
      }
    })
    
    document.getElementById('cancelBulkImport').addEventListener('click', () => {
      document.getElementById('bulkImportForm').classList.add('hidden')
      document.getElementById('bulkEnhanciveDetail').value = ''
      document.getElementById('bulkInventoryLocation').value = ''
    })
    
    async function processYamlImport(yamlText) {
      const locationSlotMap = {
        'placed in your hair': 'hair',
        'on your head': 'head',
        'slipped over your hands': 'hands',
        'on your hands': 'hands',
        'as a pin': 'pin',
        'attached to your wrist': 'wrist',
        'attached to your arms': 'arms',
        'put over your front': 'front',
        'hung from a single ear': 'single_ear',
        'hung from both ears': 'both_ears',
        'attached to your legs': 'legs_attached',
        'pulled over your legs': 'legs_pulled',
        'slipped onto your legs': 'legs_slipped',
        'on your fingers': 'fingers',
        'around your neck': 'neck',
        'slung over your shoulder': 'shoulder_slung',
        'draped over your shoulders': 'shoulders_draped',
        'on your chest': 'chest',
        'slipped onto your chest': 'chest_slipped',
        'on your back': 'back',
        'around your waist': 'waist',
        'on your belt': 'belt',
        'around your ankle': 'ankle',
        'slipped onto your feet': 'feet_slipped',
        'on your feet': 'feet_on',
        'elsewhere': 'locus'
      }
      const lines = yamlText.replace(/\\r/g, '').split('\\n')
      
      // Parse worn_items: id, name, location
      const items = {}
      let inWornItems = false
      let currentId = null
      let currentName = null
      
      for (const line of lines) {
        if (line.match(/^worn_items:/)) { inWornItems = true; continue }
        if (inWornItems && line.match(/^[a-z_]+:/) && !line.match(/^\\s/)) { inWornItems = false }
        if (!inWornItems) continue
        
        const nameMatch = line.match(/^- name:\\s*(.+)/)
        if (nameMatch) { currentName = nameMatch[1].trim(); currentId = null; continue }
        
        const idMatch = line.match(/^\\s+id:\\s*'?(\\d+)'?/)
        if (idMatch && currentName) {
          currentId = idMatch[1]
          items[currentId] = { id: currentId, name: currentName, enhancives: [] }
          continue
        }
        
        const loc = line.match(/^\\s+location:\\s*(.+)/)
        if (loc && currentId && items[currentId]) {
          items[currentId].location = loc[1].trim()
        }
      }
      
      // Parse totals: map item_id -> [{ability, boost}]
      let inTotals = false
      let currentStat = null
      let pendingAmount = null
      let pendingItemId = null
      
      for (const line of lines) {
        if (line.match(/^totals:/)) { inTotals = true; continue }
        if (!inTotals) continue
        
        if (line.match(/^    [A-Z]/)) {
          currentStat = line.split(':')[0].trim()
          continue
        }
        
        const amountMatch = line.match(/amount:\\s*(\\d+)/)
        if (amountMatch && currentStat) { pendingAmount = parseInt(amountMatch[1]) }
        
        const itemIdMatch = line.match(/item_id:\\s*'?(\\d+)'?/)
        if (itemIdMatch) { pendingItemId = itemIdMatch[1] }
        
        if (line.includes('item_name:') && pendingAmount && currentStat) {
          if (pendingItemId && items[pendingItemId]) {
            items[pendingItemId].enhancives.push({ ability: currentStat, boost: pendingAmount })
          }
          pendingAmount = null
          pendingItemId = null
        }
      }
      
      // Import items
      let imported = 0, skipped = 0
      for (const item of Object.values(items)) {
        let slot = 'elsewhere'
        if (item.location) {
          const locLower = item.location.toLowerCase()
          slot = locationSlotMap[locLower] || 'elsewhere'
        }
        
        const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_name: item.name || 'Unknown',
            slot: slot,
            enhancives_json: JSON.stringify(item.enhancives),
            is_permanent: true
          })
        })
        
        if (response.ok) imported++
        else { console.error('Failed:', item.name); skipped++ }
      }
      
      alert('Import complete! Imported: ' + imported + ', Skipped: ' + skipped)
      loadInventory()
      loadSummary()
    }

    document.getElementById('processBulkImport').addEventListener('click', async () => {
      const enhanciveDetail = document.getElementById('bulkEnhanciveDetail').value
      const inventoryLocation = document.getElementById('bulkInventoryLocation').value
      
      if (!enhanciveDetail.trim()) {
        alert('Please provide enhancive data')
        return
      }
      
      try {
        // Check if input is YAML format
        if (enhanciveDetail.trim().startsWith('---') || enhanciveDetail.includes('worn_items:')) {
          await processYamlImport(enhanciveDetail)
          return
        }
        
        if (!inventoryLocation.trim()) {
          alert('Please provide both inventory enhancive detail and inventory location')
          return
        }
        // Parse enhancive detail to extract items and their enhancives
        const itemEnhancives = {}
        const detailLines = enhanciveDetail.split('\\n')
        let currentStat = null
        
        for (const line of detailLines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('Stats:') || trimmed.startsWith('Skills:') || 
              trimmed.startsWith('Resources:') || trimmed.startsWith('Statistics:') || 
              trimmed.startsWith('For fewer') || trimmed.startsWith('Enhancive') ||
              trimmed.startsWith('Self Knowledge Spells:')) continue
          
          // Check if it's a stat/skill/resource header (e.g., "Discipline (DIS): 40/40")
          if (trimmed.match(/^[A-Za-z -]+(?:\\([A-Z]+\\))?:\\s*\\d+\\/\\d+/)) {
            const match = trimmed.match(/^([^:]+?)(?:\\s*\\([A-Z]+\\))?:/)
            if (match) currentStat = match[1].trim()
            continue
          }
          
          // Check if it's an item line (starts with +/- and has "a/an/some")
          const itemMatch = trimmed.match(/^([+-]\\d+):\\s+((?:a|an|some|the)\\s+.+?)(?:\\s*\\(|$)/)
          if (itemMatch && currentStat) {
            const boost = parseInt(itemMatch[1])
            const itemName = itemMatch[2].trim()
            
            // Skip unknown sources
            if (itemName.includes('unknown source')) continue
            
            if (!itemEnhancives[itemName]) {
              itemEnhancives[itemName] = []
            }
            itemEnhancives[itemName].push({ ability: currentStat, boost: boost })
          }
        }
        
        // Parse inventory location to map items to slots
        const itemSlots = {}
        const locationLines = inventoryLocation.split('\\n')
        let currentSlot = null
        
        for (const line of locationLines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('You are currently') || trimmed.match(/^\\(\\d+ items/)) continue
          
          // Check if it's a slot header (ends with colon)
          if (trimmed.endsWith(':')) {
            // Map slot descriptions to our slot names
            const slotMap = {
              'As a pin': 'pin',
              'On your head': 'head',
              'Placed in your hair': 'hair',
              'Hung from a single ear': 'ear',
              'Hung from both ears': 'ears',
              'Hung around your neck': 'neck',
              'Slung over your shoulder': 'shoulder',
              'Draped over your shoulders': 'shoulders',
              'On your back': 'back',
              'Over your chest': 'torso',
              'Put over your front': 'front',
              'Slipped into, on your chest': 'undershirt',
              'Attached to your arms': 'arms',
              'Attached to your wrist': 'wrist',
              'Slipped over your hands': 'hands',
              'On your fingers': 'finger',
              'Around your waist': 'waist',
              'Attached to your belt': 'belt',
              'Pulled over your legs': 'leggings',
              'Attached to your legs': 'legs',
              'Attached to your ankle': 'ankle',
              'On your feet': 'feet',
              'Slipped on your feet': 'socks',
              'As a battle standard': 'nugget',
              'Elsewhere': 'elsewhere'
            }
            const slotDesc = trimmed.slice(0, -1)
            currentSlot = slotMap[slotDesc] || 'nugget'
            continue
          }
          
          // Extract item name from line (remove functional/nonfunctional)
          const itemMatch = trimmed.match(/^((?:a|an|some|the)\\s+.+?)\\s*\\((functional|nonfunctional)\\)/)
          if (itemMatch && currentSlot) {
            const itemName = itemMatch[1].trim()
            const isFunctional = itemMatch[2] === 'functional'
            if (isFunctional) {
              itemSlots[itemName] = currentSlot
            }
          }
        }
        
        // Match items and create inventory entries
        let imported = 0
        let skipped = 0
        
        for (const [itemName, enhancives] of Object.entries(itemEnhancives)) {
          const slot = itemSlots[itemName]
          if (!slot) {
            console.log('Skipping item (no slot found):', itemName)
            skipped++
            continue
          }
          
          // Add to inventory
          const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_name: itemName,
              slot: slot,
              enhancives_json: JSON.stringify(enhancives),
              is_permanent: true
            })
          })
          
          if (response.ok) {
            imported++
          } else {
            console.error('Failed to import:', itemName)
            skipped++
          }
        }
        
        alert('Import complete!\\n\\nImported: ' + imported + ' items\\nSkipped: ' + skipped + ' items')
        document.getElementById('bulkImportForm').classList.add('hidden')
        document.getElementById('bulkEnhanciveDetail').value = ''
        document.getElementById('bulkInventoryLocation').value = ''
        loadInventory()
        
      } catch (error) {
        console.error('Bulk import error:', error)
        alert('Error processing bulk import. Check console for details.')
      }
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
        
        // Also check for "can be worn on the X"
        const canBeWornMatch = line.match(/can be worn (on|in|around|from|over|as) (?:the |your )?(head|neck|hair|ears?|shoulders?|back|chest|front|arms?|wrists?|hands?|fingers?|waist|belt|legs|ankle|feet)/i)
        if (canBeWornMatch && !detectedSlot) {
          const bodyPart = canBeWornMatch[2].toLowerCase()
          if (bodyPart === 'head') detectedSlot = 'head'
          else if (bodyPart === 'neck') detectedSlot = 'neck'
          else if (bodyPart === 'hair') detectedSlot = 'hair'
          else if (bodyPart.includes('ear')) detectedSlot = 'both_ears'
          else if (bodyPart.includes('shoulder')) detectedSlot = 'shoulders_draped'
          else if (bodyPart === 'back') detectedSlot = 'back'
          else if (bodyPart === 'chest') detectedSlot = 'chest'
          else if (bodyPart === 'front') detectedSlot = 'front'
          else if (bodyPart.includes('arm')) detectedSlot = 'arms'
          else if (bodyPart.includes('wrist')) detectedSlot = 'wrist'
          else if (bodyPart.includes('hand')) detectedSlot = 'hands'
          else if (bodyPart.includes('finger')) detectedSlot = 'fingers'
          else if (bodyPart === 'waist') detectedSlot = 'waist'
          else if (bodyPart === 'belt') detectedSlot = 'belt'
          else if (bodyPart === 'legs') detectedSlot = 'legs_attached'
          else if (bodyPart === 'ankle') detectedSlot = 'ankle'
          else if (bodyPart === 'feet') detectedSlot = 'feet_on'
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
      
      console.log('Add item clicked:', { itemName, selectedSlot, currentSetId, parsedItemData })
      
      if (!itemName || !selectedSlot || !parsedItemData) {
        alert('Please complete all fields')
        return
      }
      
      if (!currentSetId) {
        alert('No active set found. Please select a character and set first.')
        return
      }
      
      const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: itemName,
          slot: selectedSlot,
          enhancives_json: JSON.stringify(parsedItemData.enhancives),
          is_permanent: parsedItemData.isPermanent
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        alert('Error: ' + (data.error || 'Failed to add item'))
        return
      }
      
      alert('Item added to inventory!')
      document.getElementById('addItemForm').classList.add('hidden')
      document.getElementById('parsedItemInfo').classList.add('hidden')
      document.getElementById('itemTextInput').value = ''
      await loadInventory()
      await loadSlotUsage()
      await loadSummary()
    })

    async function loadInventory() {
      if (!currentSetId) return
      
      const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/inventory')
      const data = await response.json()
      
      const items = data.inventory || []
      
      const slotMapping = {
        'pin': 'pin',
        'head': 'head',
        'hair': 'hair',
        'ear': 'single_ear',
        'ears': 'both_ears',
        'neck': 'neck',
        'shoulder': 'shoulder_slung',
        'shoulders': 'shoulders_draped',
        'torso': 'chest',
        'front': 'front',
        'undershirt': 'chest_slipped',
        'back': 'back',
        'arms': 'arms',
        'wrist': 'wrist',
        'hands': 'hands',
        'finger': 'fingers',
        'waist': 'waist',
        'belt': 'belt',
        'leggings': 'legs_pulled',
        'legs': 'legs_attached',
        'ankle': 'ankle',
        'socks': 'feet_slipped',
        'feet': 'feet_on',
        'elsewhere': 'locus',
        'nugget': 'locus'
      }
      
      const slotCounts = {}
      items.forEach(item => {
        const displaySlot = slotMapping[item.slot] || item.slot
        slotCounts[displaySlot] = (slotCounts[displaySlot] || 0) + 1
      })
      
      const setResponse = await fetch(API_BASE + '/api/characters/' + currentCharacterId + '/sets')
      const setData = await setResponse.json()
      const currentSet = setData.sets.find(s => s.id == currentSetId)
      const accountType = currentSet?.account_type || 'F2P'
      
      const slotLimits = {
        'F2P': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 1, 'both_ears': 1, 'neck': 3, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 2, 'hands': 1, 'fingers': 2, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 },
        'Premium': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 2, 'both_ears': 2, 'neck': 4, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 3, 'hands': 1, 'fingers': 3, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 },
        'Platinum': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 3, 'both_ears': 3, 'neck': 5, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 4, 'hands': 1, 'fingers': 4, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 }
      }
      const limits = slotLimits[accountType] || slotLimits['F2P']
      
      const slotUsageDiv = document.getElementById('slotUsageDisplay')
      const usageText = Object.keys(limits).map(slot => {
        const count = slotCounts[slot] || 0
        const limit = limits[slot]
        const color = count >= limit ? 'text-red-600' : count >= limit * 0.8 ? 'text-yellow-600' : 'text-green-600'
        return '<span class="' + color + '">' + slot.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase()) + ': ' + count + '/' + limit + '</span>'
      }).join(' | ')
      slotUsageDiv.innerHTML = '<strong>Slot Usage:</strong> ' + usageText
      
      const invList = document.getElementById('inventoryList')
      if (items.length === 0) {
        invList.innerHTML = '<p class="text-gray-500">No items in inventory. Add one to get started!</p>'
        return
      }
      
      invList.innerHTML = items.map(item => {
        const enhs = JSON.parse(item.enhancives_json)
        const enhText = enhs.map(e => '+' + e.boost + ' ' + e.ability).join(', ')
        const lockIcon = item.is_irreplaceable ? '🔒 ' : ''
        const permanentClass = item.is_permanent ? 'bg-white' : 'bg-yellow-50'
        const irreplaceableClass = item.is_irreplaceable ? 'border-blue-500 border-2' : ''
        const slotDisplay = item.slot.replace(/_/g, ' ')
        const tempWarning = !item.is_permanent ? '<div class="text-xs text-orange-600 mt-1">⚠ Temporary (will crumble)<\/div>' : ''
        const checkedAttr = item.is_irreplaceable ? 'checked' : ''
        
        const html = [
          '<div class="p-3 border rounded ' + permanentClass + ' ' + irreplaceableClass + '">',
          '<div class="flex justify-between items-start">',
          '<div class="flex-1">',
          '<div class="font-semibold">' + lockIcon + item.item_name + '<\/div>',
          '<div class="text-sm text-gray-600">Slot: ' + slotDisplay + '<\/div>',
          '<div class="text-sm text-gray-700">' + enhText + '<\/div>',
          tempWarning,
          '<label class="flex items-center gap-1 text-xs text-gray-600 mt-2 cursor-pointer">',
          '<input type="checkbox" ' + checkedAttr + ' onchange="toggleIrreplaceable(' + item.id + ', this.checked)" class="cursor-pointer">',
          '<span>Mark as irreplaceable<\/span>',
          '<\/label>',
          '<\/div>',
          '<div class="flex gap-2">',
          '<button onclick="editInventoryItem(' + item.id + ')" class="text-blue-600 hover:text-blue-800 text-sm">Edit<\/button>',
          '<button onclick="deleteInventoryItem(' + item.id + ')" class="text-red-600 hover:text-red-800 text-sm">Delete<\/button>',
          '<\/div>',
          '<\/div>',
          '<\/div>'
        ]
        return html.join('')
      }).join('')
    }

    window.editInventoryItem = async function(id) {
      const response = await fetch(API_BASE + '/api/set-inventory/' + id)
      const data = await response.json()
      const item = data.item
      
      if (!item) return
      
      document.getElementById('editItemName').value = item.item_name
      document.getElementById('editItemSlot').value = item.slot
      document.getElementById('editItemPermanent').checked = item.is_permanent
      
      document.getElementById('editInvModal').classList.remove('hidden')
      document.getElementById('editInvModal').dataset.itemId = id
    }

    window.deleteInventoryItem = async function(id) {
      if (!confirm('Delete this item from inventory?')) return
      await fetch(API_BASE + '/api/set-inventory/' + id, { method: 'DELETE' })
      await loadInventory()
      await loadSlotUsage()
      await loadSummary()
    }

    window.toggleIrreplaceable = async function(id, isIrreplaceable) {
      try {
        await fetch(API_BASE + '/api/inventory/' + id + '/irreplaceable', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_irreplaceable: isIrreplaceable })
        })
        await loadInventory()
      } catch (error) {
        console.error('Error toggling irreplaceable:', error)
        alert('Failed to update item')
      }
    }

    async function loadSlotUsage() {
      if (!currentSetId) return
      
      const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/inventory')
      const data = await response.json()
      
      const items = data.inventory || []
      
      // Map database slot names to display slot names
      const slotMapping = {
        'pin': 'pin',
        'head': 'head',
        'hair': 'hair',
        'ear': 'single_ear',
        'ears': 'both_ears',
        'neck': 'neck',
        'shoulder': 'shoulder_slung',
        'shoulders': 'shoulders_draped',
        'torso': 'chest',
        'front': 'front',
        'undershirt': 'chest_slipped',
        'back': 'back',
        'arms': 'arms',
        'wrist': 'wrist',
        'hands': 'hands',
        'finger': 'fingers',
        'waist': 'waist',
        'belt': 'belt',
        'leggings': 'legs_pulled',
        'legs': 'legs_attached',
        'ankle': 'ankle',
        'socks': 'feet_slipped',
        'feet': 'feet_on',
        'elsewhere': 'locus',
        'nugget': 'locus'
      }
      
      const slotCounts = {}
      items.forEach(item => {
        const displaySlot = slotMapping[item.slot] || item.slot
        slotCounts[displaySlot] = (slotCounts[displaySlot] || 0) + 1
      })
      console.log('Slot counts:', slotCounts)
      
      const slotLimits = {
        'F2P': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 1, 'both_ears': 1, 'neck': 3, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 2, 'hands': 1, 'fingers': 2, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 },
        'Premium': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 2, 'both_ears': 2, 'neck': 4, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 3, 'hands': 1, 'fingers': 3, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 },
        'Platinum': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 3, 'both_ears': 3, 'neck': 5, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 4, 'hands': 1, 'fingers': 4, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 }
      }
      
      const setResponse = await fetch(API_BASE + '/api/characters/' + currentCharacterId + '/sets')
      const setData = await setResponse.json()
      const currentSet = setData.sets.find(s => s.id == currentSetId)
      const accountType = currentSet?.account_type || 'F2P'
      console.log('Account type:', accountType, 'Limits keys:', Object.keys(slotLimits[accountType] || slotLimits['F2P']))
      const limits = slotLimits[accountType] || slotLimits['F2P']
      
      const slotUsageSection = document.getElementById('slotUsageSection')
      const mainSlotUsage = document.getElementById('mainSlotUsage')
      
      const usageText = Object.keys(limits).map(slot => {
        const count = slotCounts[slot] || 0
        const limit = limits[slot]
        const color = count >= limit ? 'text-red-600' : count >= limit * 0.8 ? 'text-yellow-600' : 'text-green-600'
        return '<span class="' + color + ' font-medium">' + slot.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase()) + ': ' + count + '/' + limit + '</span>'
      }).join(' | ')
      
      if (usageText) {
        slotUsageSection.classList.remove('hidden')
        mainSlotUsage.innerHTML = usageText
      } else {
        slotUsageSection.classList.add('hidden')
      }
    }

    async function loadSummary() {
      if (!currentSetId) return
      
      const response = await fetch(API_BASE + '/api/summary?set_id=' + currentSetId)
      const data = await response.json()
      
      const summarySection = document.getElementById('summarySection')
      const statsSummary = document.getElementById('statsSummary')
      const skillsSummary = document.getElementById('skillsSummary')
      
      if (Object.keys(data.stats).length === 0 && Object.keys(data.skills).length === 0) {
        summarySection.classList.add('hidden')
        return
      }
      
      summarySection.classList.remove('hidden')
      
      statsSummary.innerHTML = Object.entries(data.stats).map(([name, vals]) => {
        let color = 'text-red-600'
        if (vals.enhancive >= vals.cap) color = 'text-green-600'
        else if (vals.enhancive >= vals.cap * 0.8) color = 'text-yellow-600'
        
        const isRecovery = name.includes('Recovery')
        const displayText = isRecovery 
          ? vals.enhancive + '/' + vals.cap
          : vals.base + ' + ' + vals.enhancive + ' = ' + vals.total + ' [' + vals.enhancive + '/' + vals.cap + ']'
        
        return '<div class="flex justify-between items-center p-2 border-b"><span class="font-medium">' + name + ':</span><span class="' + color + '">' + displayText + '</span></div>'
      }).join('')
      
      skillsSummary.innerHTML = Object.entries(data.skills).map(([name, vals]) => {
        let color = 'text-red-600'
        if (vals.enhancive >= vals.cap) color = 'text-green-600'
        else if (vals.enhancive >= vals.cap * 0.8) color = 'text-yellow-600'
        
        const isRecovery = name.includes('Recovery')
        const displayText = isRecovery 
          ? vals.enhancive + '/' + vals.cap
          : vals.base + ' + ' + vals.enhancive + ' = ' + vals.total + ' [' + vals.enhancive + '/' + vals.cap + ']'
        
        return '<div class="flex justify-between items-center p-2 border-b"><span class="font-medium">' + name + ':</span><span class="' + color + '">' + displayText + '</span></div>'
      }).join('')
    }

    document.getElementById('myMatchesBtn').addEventListener('click', async () => {
      if (!currentUser) {
        alert('Please log in first')
        return
      }
      if (!currentSetName) {
        alert('Please select a character set first')
        return
      }
      const response = await fetch(API_BASE + '/api/my-matches?discord_id=' + currentUser.id + '&set_name=' + encodeURIComponent(currentSetName))
      const data = await response.json()
      
      const availableDiv = document.getElementById('availableMatches')
      const soldDiv = document.getElementById('soldMatches')
      
      if (data.available.length === 0) {
        availableDiv.innerHTML = '<p class="text-gray-500">No available matches yet</p>'
      } else {
        availableDiv.innerHTML = data.available.map(item => {
          const enhs = JSON.parse(item.enhancives_json)
          const enhText = enhs.map(e => \`+\${e.boost} \${e.ability}\`).join(', ')
          const isNugget = !item.worn || item.worn === 'N/A'
          const displayCost = (isNugget && shouldShowNuggetPrice(item)) ? (item.cost || 0) + 25000000 : item.cost
          return \`
            <div class="p-3 border rounded bg-green-50">
              <div class="font-semibold">\${item.name}</div>
              <div class="text-sm text-gray-600">\${item.town} - \${item.shop} - \${displayCost?.toLocaleString()} silvers</div>
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
          const isNugget = !item.worn || item.worn === 'N/A'
          const displayCost = (isNugget && shouldShowNuggetPrice(item)) ? (item.cost || 0) + 25000000 : item.cost
          return \`
            <div class="p-3 border rounded bg-gray-100">
              <div class="font-semibold text-gray-600">\${item.name}</div>
              <div class="text-sm text-gray-500">\${item.town} - \${item.shop} - \${displayCost?.toLocaleString()} silvers</div>
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

    // Match tab switching
    document.querySelectorAll('.match-tab').forEach(tab => {
      tab.addEventListener('click', async (e) => {
        const target = e.currentTarget
        const tabName = target.dataset.tab
        
        document.querySelectorAll('.match-tab').forEach(t => {
          t.classList.remove('border-blue-600', 'text-blue-600')
          t.classList.add('text-gray-500')
        })
        target.classList.add('border-blue-600', 'text-blue-600')
        target.classList.remove('text-gray-500')
        
        document.querySelectorAll('.match-panel').forEach(p => p.classList.add('hidden'))
        document.getElementById(tabName).classList.remove('hidden')
        
        // Show Recalculate button only on recommendation tabs
        const recalcBtn = document.getElementById('recalculateBtn')
        if (tabName.startsWith('rec')) {
          recalcBtn.classList.remove('hidden')
        } else {
          recalcBtn.classList.add('hidden')
        }
        
        if (tabName.startsWith('rec') && !document.getElementById(tabName).dataset.loaded) {
          await loadRecommendations()
          document.getElementById(tabName).dataset.loaded = 'true'
        }
      })
    })

    document.getElementById('recalculateBtn').addEventListener('click', async () => {
      if (!currentUser || !currentSetName) return
      
      const btn = document.getElementById('recalculateBtn')
      btn.disabled = true
      
      const steps = ['Clearing cache...', 'Loading goals...', 'Analyzing items...', 'Done!']
      let stepIndex = 0
      
      const updateProgress = () => {
        btn.textContent = steps[stepIndex]
        stepIndex++
      }
      
      updateProgress()
      await new Promise(r => setTimeout(r, 300))
      
      await fetch(API_BASE + '/api/recommendations/' + currentUser.id + '/' + encodeURIComponent(currentSetName), { method: 'DELETE' })
      
      updateProgress()
      await new Promise(r => setTimeout(r, 300))
      
      // Clear loaded flags
      document.querySelectorAll('.match-panel[id^="rec"]').forEach(p => p.dataset.loaded = '')
      
      updateProgress()
      
      // Reload current tab
      await loadRecommendations()
      const activeTab = document.querySelector('.match-tab.border-blue-600')
      if (activeTab) {
        document.getElementById(activeTab.dataset.tab).dataset.loaded = 'true'
      }
      
      updateProgress()
      await new Promise(r => setTimeout(r, 500))
      
      btn.disabled = false
      btn.textContent = 'Recalculate'
    })

    async function loadRecommendations() {
      if (!currentUser || !currentSetName) return
      
      const response = await fetch(API_BASE + '/api/recommendations/' + currentUser.id + '/' + encodeURIComponent(currentSetName))
      const data = await response.json()
      
      const renderRec = (rec) => {
        const enhs = JSON.parse(rec.item.enhancives_json)
        const enhText = enhs.map(e => '+' + e.boost + ' ' + e.ability).join(', ')
        return '<div class="p-3 border rounded bg-white"><div class="font-semibold">' + rec.item.item_name + '<\/div><div class="text-sm text-gray-600">Cost: ' + rec.totalCost.toLocaleString() + ' silvers<\/div><div class="text-sm text-gray-700">' + enhText + '<\/div><div class="text-xs text-blue-600 mt-1">' + rec.explanation + '<\/div><\/div>'
      }
      
      document.getElementById('directRecList').innerHTML = data.direct?.length ? data.direct.map(renderRec).join('') : '<p class="text-gray-500">No direct matches found<\/p>'
      document.getElementById('nuggetRecList').innerHTML = data.nuggets?.length ? data.nuggets.map(renderRec).join('') : '<p class="text-gray-500">No nugget opportunities<\/p>'
      document.getElementById('swatchRecList').innerHTML = data.swatches?.length ? data.swatches.map(renderRec).join('') : '<p class="text-gray-500">No swatch opportunities<\/p>'
      document.getElementById('swapRecList').innerHTML = data.swaps?.length ? data.swaps.map(renderRec).join('') : '<p class="text-gray-500">No swap recommendations<\/p>'
    }

    document.getElementById('aiChatBtn').addEventListener('click', () => {
      const saved = localStorage.getItem('chatHistory_' + currentUser.id)
      if (saved) {
        chatHistory = JSON.parse(saved)
        chatHistory.forEach(msg => addChatMessage(msg.content, msg.role === 'user'))
      }
      document.getElementById('aiChatModal').classList.remove('hidden')
      document.getElementById('chatInput').focus()
    })

    document.getElementById('closeAiChatBtn').addEventListener('click', () => {
      document.getElementById('aiChatModal').classList.add('hidden')
    })

    document.getElementById('clearChatBtn').addEventListener('click', () => {
      chatHistory = []
      localStorage.removeItem('chatHistory_' + currentUser.id)
      document.getElementById('chatMessages').innerHTML = ''
    })

    document.getElementById('sendChatBtn').addEventListener('click', async () => {
      const input = document.getElementById('chatInput')
      const message = input.value.trim()
      if (!message) return
      
      addChatMessage(message, true)
      input.value = ''
      
      chatHistory.push({ role: 'user', content: message })
      
      addChatMessage('...', false)
      const loadingMsg = document.getElementById('chatMessages').lastChild
      
      const response = await fetch(API_BASE + '/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, discord_id: currentUser.id, history: chatHistory })
      })
      const data = await response.json()
      
      loadingMsg.remove()
      
      if (data.error) {
        addChatMessage('Error: ' + data.error, false)
      } else {
        // Log SQL query to console for debugging
        if (data.sql) {
          console.log('AI Generated SQL:', data.sql)
        }
        
        addChatMessage(data.response, false)
        chatHistory.push({ role: 'assistant', content: data.response })
        localStorage.setItem('chatHistory_' + currentUser.id, JSON.stringify(chatHistory))
      }
    })

    document.getElementById('chatInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        document.getElementById('sendChatBtn').click()
      }
    })

    document.querySelectorAll('.example-query').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('chatInput').value = btn.textContent
        document.getElementById('sendChatBtn').click()
      })
    })

    document.getElementById('addGoalBtn').addEventListener('click', () => {
      // Clear form for new goal
      document.getElementById('goalStat').value = ''
      document.getElementById('goalBoost').value = ''
      document.getElementById('goalMaxCost').value = ''
      document.querySelectorAll('input[name="goalSlot"]').forEach(cb => cb.checked = false)
      document.getElementById('nuggetPriceOption').classList.add('hidden')
      document.getElementById('goalNuggetPrice').checked = false
      editingGoalId = null
      document.getElementById('saveGoalBtn').textContent = 'Save Goal'
      document.getElementById('addGoalForm').classList.remove('hidden')
    })

    document.getElementById('cancelGoalBtn').addEventListener('click', () => {
      document.getElementById('addGoalForm').classList.add('hidden')
      editingGoalId = null
      document.getElementById('saveGoalBtn').textContent = 'Save Goal'
    })

    document.getElementById('goalNuggetCheckbox').addEventListener('change', (e) => {
      const priceOption = document.getElementById('nuggetPriceOption')
      if (e.target.checked) {
        priceOption.classList.remove('hidden')
      } else {
        priceOption.classList.add('hidden')
        document.getElementById('goalNuggetPrice').checked = false
      }
    })

    document.getElementById('saveGoalBtn').addEventListener('click', async () => {
      const stat = document.getElementById('goalStat').value
      const boost = document.getElementById('goalBoost').value
      const maxCost = document.getElementById('goalMaxCost').value
      const includeNuggetPrice = document.getElementById('goalNuggetPrice').checked ? 1 : 0
      const selectedSlots = Array.from(document.querySelectorAll('input[name="goalSlot"]:checked'))
        .map(cb => cb.value)
        .join(',')

      if (!stat || !boost) {
        alert('Stat and Min Boost are required')
        return
      }

      if (editingGoalId) {
        await fetch(API_BASE + '/api/set-goals/' + editingGoalId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stat,
            min_boost: parseInt(boost),
            max_cost: maxCost ? parseInt(maxCost) : null,
            preferred_slots: selectedSlots || null,
            include_nugget_price: includeNuggetPrice
          }),
        })
        editingGoalId = null
        document.getElementById('saveGoalBtn').textContent = 'Save Goal'
      } else {
        if (!currentSetId) {
          alert('No active set found. Please select a character and set first.')
          return
        }
        
        const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stat,
            min_boost: parseInt(boost),
            max_cost: maxCost ? parseInt(maxCost) : null,
            preferred_slots: selectedSlots || null,
            include_nugget_price: includeNuggetPrice
          }),
        })
        
        const data = await response.json()
        if (!response.ok) {
          alert('Error adding goal: ' + (data.error || 'Unknown error'))
          return
        }
      }

      document.getElementById('goalStat').value = ''
      document.getElementById('goalBoost').value = ''
      document.getElementById('goalMaxCost').value = ''
      document.querySelectorAll('input[name="goalSlot"]').forEach(cb => cb.checked = false)
      document.getElementById('nuggetPriceOption').classList.add('hidden')
      document.getElementById('goalNuggetPrice').checked = false
      document.getElementById('addGoalForm').classList.add('hidden')
      
      await loadGoalsForSet()
      
      // Reload user goals and re-apply filter if enabled
      if (currentUser && currentSetId) {
        const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/goals')
        const data = await response.json()
        userGoals = data.goals || []
        
        if (filterByGoalsEnabled) {
          filterItems()
        }
      }
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
      
      // Map slots, converting crossbows and N/A to nugget
      const worn = [...new Set(allItems.map(item => {
        if (item.name.toLowerCase().includes('crossbow')) return 'nugget'
        if (!item.worn || item.worn === 'N/A') return 'nugget'
        return item.worn
      }).filter(Boolean))].sort()
      
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

    // Sorting state
    let currentSortColumn = null
    let currentSortDirection = 'asc'

    window.sortItems = function(column) {
      // Toggle direction if clicking same column
      if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        currentSortColumn = column
        // Default desc for sum columns, asc for others
        currentSortDirection = (column === 'matchSum' || column === 'totalSum') ? 'desc' : 'asc'
      }
      
      filteredItems.sort((a, b) => {
        let aVal, bVal
        
        switch(column) {
          case 'name':
            aVal = a.name.toLowerCase()
            bVal = b.name.toLowerCase()
            break
          case 'town':
            aVal = a.town.toLowerCase()
            bVal = b.town.toLowerCase()
            break
          case 'cost':
            aVal = a.cost || 0
            bVal = b.cost || 0
            break
          case 'slot':
            aVal = (a.worn || '').toLowerCase()
            bVal = (b.worn || '').toLowerCase()
            break
          case 'matchSum':
            aVal = calculateMatchSum(a)
            bVal = calculateMatchSum(b)
            break
          case 'totalSum':
            aVal = calculateTotalSum(a)
            bVal = calculateTotalSum(b)
            break
          default:
            return 0
        }
        
        if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1
        return 0
      })
      
      renderItems()
    }

    // Calculate match sum for an item based on user goals
    // Calculate bonus value for skill ranks based on diminishing returns (advanced mode)
    function calculateSkillRankBonus(currentRanks, additionalRanks) {
      if (!useAdvancedSkillCalc) {
        // Basic mode: 1 rank = 1 point
        return additionalRanks
      }
      
      // Advanced mode: diminishing returns formula
      let bonus = 0
      for (let i = 1; i <= additionalRanks; i++) {
        const rank = currentRanks + i
        if (rank <= 10) bonus += 5
        else if (rank <= 20) bonus += 4
        else if (rank <= 30) bonus += 3
        else if (rank <= 40) bonus += 2
        else bonus += 1
      }
      return bonus
    }

    function shouldShowNuggetPrice(item) {
      if (!userGoals || userGoals.length === 0) return false
      const isNugget = !item.worn || item.worn === 'N/A'
      if (!isNugget) return false
      
      try {
        const enhancives = JSON.parse(item.enhancives_json)
        return enhancives.some(enh => {
          const ability = enh.ability.toLowerCase()
          return userGoals.some(goal => 
            ability.includes(goal.stat.toLowerCase()) && goal.include_nugget_price === 1
          )
        })
      } catch {
        return false
      }
    }

    function calculateMatchSum(item) {
      if (!userGoals || userGoals.length === 0) return 0
      
      try {
        const enhancives = JSON.parse(item.enhancives_json)
        let sum = 0
        
        for (const enh of enhancives) {
          const ability = enh.ability.toLowerCase()
          
          // Check if this enhancive matches any user goal
          const matchesGoal = userGoals.some(goal => 
            ability.includes(goal.stat.toLowerCase())
          )
          
          if (!matchesGoal) continue
          
          // Handle skill ranks
          if (ability.includes('ranks')) {
            const skillName = enh.ability.replace(/s+ranks$/i, '').trim()
            const currentRanks = currentCharacterSkills ? (currentCharacterSkills[skillName] || 0) : 0
            sum += calculateSkillRankBonus(currentRanks, enh.boost)
            continue
          }
          
          // Only STAT Bonus counts as 2x (they give both stat and bonus)
          // Skill Bonus is 1x flat
          // Everything else is 1x: Base stats, Max Mana, Max Stamina, Max Health, Spirit Recovery, etc.
          const statBonuses = ['strength bonus', 'constitution bonus', 'dexterity bonus', 'agility bonus', 
                               'discipline bonus', 'aura bonus', 'logic bonus', 'intuition bonus', 
                               'wisdom bonus', 'influence bonus']
          const isStatBonus = statBonuses.some(stat => ability.includes(stat))
          
          if (isStatBonus) {
            sum += enh.boost * 2
          } else {
            sum += enh.boost
          }
        }
        
        return sum
      } catch {
        return 0
      }
    }
    
    // Calculate total sum of ALL enhancives on an item
    function calculateTotalSum(item) {
      try {
        const enhancives = JSON.parse(item.enhancives_json)
        let sum = 0
        
        for (const enh of enhancives) {
          const ability = enh.ability.toLowerCase()
          
          // Handle skill ranks
          if (ability.includes('ranks')) {
            const skillName = enh.ability.replace(/s+ranks$/i, '').trim()
            const currentRanks = currentCharacterSkills ? (currentCharacterSkills[skillName] || 0) : 0
            sum += calculateSkillRankBonus(currentRanks, enh.boost)
            continue
          }
          
          // Only STAT Bonus counts as 2x (they give both stat and bonus)
          // Skill Bonus is 1x flat
          // Everything else is 1x: Base stats, Max Mana, Max Stamina, Max Health, Spirit Recovery, etc.
          const statBonuses = ['strength bonus', 'constitution bonus', 'dexterity bonus', 'agility bonus', 
                               'discipline bonus', 'aura bonus', 'logic bonus', 'intuition bonus', 
                               'wisdom bonus', 'influence bonus']
          const isStatBonus = statBonuses.some(stat => ability.includes(stat))
          
          if (isStatBonus) {
            sum += enh.boost * 2
          } else {
            sum += enh.boost
          }
        }
        
        return sum
      } catch {
        return 0
      }
    }

    function filterItems() {
      const searchName = document.getElementById('searchName').value.toLowerCase()
      const filterTown = document.getElementById('filterTown').value
      const filterWorn = document.getElementById('filterWorn').value
      const filterStat = document.getElementById('filterStat').value

      filteredItems = allItems.filter(item => {
        if (searchName && !item.name.toLowerCase().includes(searchName)) return false
        if (filterPermanentOnly && !item.is_permanent) return false
        if (filterTown && item.town !== filterTown) return false
        
        // Handle nugget slot filter
        if (filterWorn) {
          let itemSlot = item.worn || ''
          if (item.name.toLowerCase().includes('crossbow')) {
            itemSlot = 'nugget'
          } else if (!item.worn || item.worn.trim() === '' || item.worn === 'N/A') {
            itemSlot = 'nugget'
          }
          
          if (itemSlot !== filterWorn) return false
        }
        
        if (filterStat) {
          try {
            const enhancives = JSON.parse(item.enhancives_json)
            if (!enhancives.some(e => e.ability === filterStat)) return false
          } catch {
            return false
          }
        }
        
        // Filter by goals if enabled
        if (filterByGoalsEnabled && userGoals.length > 0) {
          let matchesAnyGoal = false
          
          for (const goal of userGoals) {
            try {
              const enhancives = JSON.parse(item.enhancives_json)
              
              // Check if item matches this goal
              const hasStatMatch = enhancives.some(enh => 
                enh.ability.toLowerCase().includes(goal.stat.toLowerCase()) && 
                enh.boost >= Number(goal.min_boost)
              )
              
              if (!hasStatMatch) continue
              
              // Check cost constraint
              if (goal.max_cost && item.cost > Number(goal.max_cost)) continue
              
              // Check slot preference
              if (goal.preferred_slots) {
                const slots = goal.preferred_slots.split(',').map(s => s.trim())
                
                // Determine actual slot (convert to nugget if needed)
                let itemSlot = item.worn
                if (item.name.toLowerCase().includes('crossbow')) {
                  itemSlot = 'nugget'
                } else if (!item.worn || item.worn.trim() === '' || item.worn === 'N/A') {
                  itemSlot = 'nugget'
                }
                
                if (!slots.includes(itemSlot)) continue
              }
              
              matchesAnyGoal = true
              break
            } catch {
              continue
            }
          }
          
          if (!matchesAnyGoal) return false
        }
        
        return true
      })
      
      // Auto-sort by Match Sum when filtering by goals
      if (filterByGoalsEnabled && userGoals.length > 0) {
        currentSortColumn = 'matchSum'
        currentSortDirection = 'desc'
        filteredItems.sort((a, b) => {
          const aSum = calculateMatchSum(a)
          const bSum = calculateMatchSum(b)
          return bSum - aSum // Descending
        })
      }

      renderItems()
    }

    function renderItems() {
      const tbody = document.getElementById('itemsTable')
      tbody.innerHTML = ''

      document.getElementById('totalItems').textContent = filteredItems.length
      
      // Update goal filter status
      const statusEl = document.getElementById('goalFilterStatus')
      if (filterByGoalsEnabled && userGoals.length > 0) {
        statusEl.textContent = 'Filtering by ' + userGoals.length + ' goal' + (userGoals.length > 1 ? 's' : '')
        statusEl.classList.remove('hidden')
      } else {
        statusEl.classList.add('hidden')
      }

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
        
        const matchSum = calculateMatchSum(item)
        const matchSumDisplay = matchSum > 0 ? matchSum : '-'
        
        const totalSum = calculateTotalSum(item)
        const totalSumDisplay = totalSum > 0 ? totalSum : '-'
        
        // Override slot for crossbows (Nugget items)
        let displaySlot = item.worn || 'N/A'
        const isNugget = item.name.toLowerCase().includes('crossbow') || !item.worn || item.worn === 'N/A'
        if (isNugget) {
          displaySlot = 'nugget'
        }
        
        // Calculate display cost (add 25M if nugget and matching goal has flag)
        let displayCost = item.cost || 0
        let costLabel = ''
        if (isNugget && shouldShowNuggetPrice(item)) {
          displayCost = displayCost + 25000000
          costLabel = '<div class="text-xs text-yellow-600">+NUGGET</div>'
        }
        
        // Add crumble icon for temporary items
        const crumbleIcon = !item.is_permanent ? '<span title="Temporary - will crumble">⚠️</span> ' : ''

        tr.innerHTML = \`
          <td class="px-4 py-3">\${crumbleIcon}\${item.name}</td>
          <td class="px-4 py-3">\${item.town}</td>
          <td class="px-4 py-3">\${item.shop}</td>
          <td class="px-4 py-3 text-right">\${displayCost ? displayCost.toLocaleString() : 'N/A'}\${costLabel}</td>
          <td class="px-4 py-3">\${displaySlot}</td>
          <td class="px-4 py-3 text-right font-semibold \${matchSum > 0 ? 'text-green-600' : 'text-gray-400'}">\${matchSumDisplay}</td>
          <td class="px-4 py-3 text-right font-semibold text-blue-600">\${totalSumDisplay}</td>
          <td class="px-4 py-3 text-sm">\${enhancivesText}</td>
        \`
        tbody.appendChild(tr)
      })

      if (filteredItems.length > 500) {
        const tr = document.createElement('tr')
        tr.innerHTML = \`<td colspan="8" class="px-4 py-3 text-center text-gray-500">Showing first 500 of \${filteredItems.length} items</td>\`
        tbody.appendChild(tr)
      }
    }

    document.getElementById('searchName').addEventListener('input', filterItems)
    document.getElementById('filterTown').addEventListener('change', filterItems)
    document.getElementById('filterWorn').addEventListener('change', filterItems)
    document.getElementById('filterStat').addEventListener('change', filterItems)
    
    document.getElementById('filterByGoals').addEventListener('change', async (e) => {
      filterByGoalsEnabled = e.target.checked
      localStorage.setItem('filterByGoals', filterByGoalsEnabled)
      
      if (filterByGoalsEnabled && currentUser && currentSetId) {
        const response = await fetch(API_BASE + '/api/sets/' + currentSetId + '/goals')
        const data = await response.json()
        userGoals = data.goals || []
      }
      
      filterItems()
    })
    
    document.getElementById('useAdvancedSkillCalc').addEventListener('change', (e) => {
      useAdvancedSkillCalc = e.target.checked
      localStorage.setItem('useAdvancedSkillCalc', useAdvancedSkillCalc)
      renderItems()
    })
    
    document.getElementById('filterPermanentOnly').addEventListener('change', (e) => {
      filterPermanentOnly = e.target.checked
      localStorage.setItem('filterPermanentOnly', filterPermanentOnly)
      filterItems()
    })
    
    // Restore checkbox state
    const savedFilter = localStorage.getItem('filterByGoals')
    if (savedFilter === 'true') {
      document.getElementById('filterByGoals').checked = true
      filterByGoalsEnabled = true
    }
    
    const savedPermanentFilter = localStorage.getItem('filterPermanentOnly')
    if (savedPermanentFilter === 'true') {
      document.getElementById('filterPermanentOnly').checked = true
      filterPermanentOnly = true
    }
    
    
    const savedAdvancedSkill = localStorage.getItem('useAdvancedSkillCalc')
    if (savedAdvancedSkill === 'true') {
      document.getElementById('useAdvancedSkillCalc').checked = true
      useAdvancedSkillCalc = true
    }

    initAuth()
    loadItems()
  </script>
</body>
</html>`)
})

app.get('/enh_export.lic', async (c) => {
  const script = await fetch('https://raw.githubusercontent.com/Buckwheet/GS4-EnhanciveShopper/main/enh_export.lic')
  const text = await script.text()
  return c.text(text, 200, {
    'Content-Type': 'text/plain',
    'Content-Disposition': 'attachment; filename="enh_export.lic"'
  })
})

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.post('/api/trigger-scrape', async (c) => {
  const env = c.env as Env
  const result = await runScrape(env)
  return c.json(result)
})

app.get('/api/scrape-health', async (c) => {
  const env = c.env as Env
  const { results } = await env.DB.prepare(
    'SELECT * FROM scrape_log ORDER BY id DESC LIMIT 20'
  ).all()
  const lastSuccess = await env.DB.prepare(
    "SELECT ran_at FROM scrape_log WHERE status = 'updated' ORDER BY id DESC LIMIT 1"
  ).first() as { ran_at: string } | null
  const hoursSinceSuccess = lastSuccess
    ? (Date.now() - new Date(lastSuccess.ran_at).getTime()) / 3600000
    : null
  return c.json({
    healthy: hoursSinceSuccess !== null && hoursSinceSuccess < 3,
    hours_since_last_success: hoursSinceSuccess ? Math.round(hoursSinceSuccess * 10) / 10 : null,
    recent_runs: results,
  })
})

app.post('/api/test-scrape-alert', async (c) => {
  const env = c.env as Env
  const sent = await sendDiscordDM(env.DISCORD_BOT_TOKEN, ADMIN_DISCORD_ID,
    `🧪 **Test Alert**\nScrape monitoring is working!\nTime: ${new Date().toISOString()}`)
  return c.json({ sent })
})

app.get('/api/user/settings', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const user = await c.env.DB.prepare('SELECT notifications_enabled FROM users WHERE discord_id = ?').bind(discordId).first()
  
  return c.json({ notifications_enabled: user?.notifications_enabled === 1 })
})

app.put('/api/user/settings', async (c) => {
  const { discord_id, notifications_enabled } = await c.req.json()
  if (!discord_id) return c.json({ error: 'discord_id required' }, 400)

  await c.env.DB.prepare(
    'INSERT INTO users (discord_id, notifications_enabled) VALUES (?, ?) ON CONFLICT(discord_id) DO UPDATE SET notifications_enabled = ?'
  ).bind(discord_id, notifications_enabled ? 1 : 0, notifications_enabled ? 1 : 0).run()

  return c.json({ success: true })
})

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

    const tokens = await tokenResponse.json() as { access_token?: string }
    console.log('Token response:', tokens)
    
    if (!tokens.access_token) {
      return c.json({ error: 'Failed to get access token', details: tokens }, 400)
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    const discordUser = await userResponse.json() as { id?: string; username?: string }
    console.log('Discord user:', discordUser)

    await c.env.DB.prepare(
      'INSERT INTO users (discord_id, discord_username, created_at) VALUES (?, ?, ?) ON CONFLICT(discord_id) DO UPDATE SET discord_username = ?, last_login = ?'
    ).bind(discordUser.id as string, discordUser.username as string, new Date().toISOString(), discordUser.username as string, new Date().toISOString()).run()

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
  goalsQuery.results.forEach(r => { sets.add(r.goal_set_name || 'Default') })
  invQuery.results.forEach(r => { sets.add(r.goal_set_name || 'Default') })
  
  return c.json({ sets: [...sets] })
})

// New API: Get character sets
// New API: Get all characters for user
app.get('/api/characters', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const { results: characters } = await c.env.DB.prepare('SELECT * FROM characters WHERE discord_id = ?')
    .bind(discordId)
    .all()

  return c.json({ characters })
})

// New API: Create character
app.post('/api/characters', async (c) => {
  const { discord_id, character_name, base_stats, skill_ranks } = await c.req.json()
  
  if (!discord_id || !character_name) {
    return c.json({ error: 'discord_id and character_name required' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO characters (discord_id, character_name, base_stats, skill_ranks, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(discord_id, character_name, base_stats || null, skill_ranks || null, new Date().toISOString()).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// New API: Update character
app.put('/api/characters/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const updates: string[] = []
  const values: any[] = []
  if (body.character_name !== undefined) { updates.push('character_name = ?'); values.push(body.character_name) }
  if (body.base_stats !== undefined) { updates.push('base_stats = ?'); values.push(body.base_stats || null) }
  if (body.skill_ranks !== undefined) { updates.push('skill_ranks = ?'); values.push(body.skill_ranks || null) }
  if (updates.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400)
  values.push(id)
  await c.env.DB.prepare(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  return c.json({ success: true })
})

// New API: Delete character
app.delete('/api/characters/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM characters WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// New API: Get sets for character
app.get('/api/characters/:id/sets', async (c) => {
  const characterId = c.req.param('id')
  
  const { results: sets } = await c.env.DB.prepare('SELECT * FROM sets WHERE character_id = ?')
    .bind(characterId)
    .all()

  return c.json({ sets })
})

// New API: Create set for character
app.post('/api/characters/:id/sets', async (c) => {
  const characterId = c.req.param('id')
  const { set_name, account_type } = await c.req.json()
  
  if (!set_name) {
    return c.json({ error: 'set_name required' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO sets (character_id, set_name, account_type, created_at) VALUES (?, ?, ?, ?)'
  ).bind(characterId, set_name, account_type || 'F2P', new Date().toISOString()).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// New API: Update set
app.put('/api/sets/:id', async (c) => {
  const id = c.req.param('id')
  const { set_name, account_type } = await c.req.json()

  await c.env.DB.prepare(
    'UPDATE sets SET set_name = ?, account_type = ? WHERE id = ?'
  ).bind(set_name, account_type, id).run()

  return c.json({ success: true })
})

// New API: Delete set
app.delete('/api/sets/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM sets WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// New API: Get goals for set
app.get('/api/sets/:id/goals', async (c) => {
  const setId = c.req.param('id')
  
  const { results: goals } = await c.env.DB.prepare('SELECT * FROM set_goals WHERE set_id = ?')
    .bind(setId)
    .all()

  return c.json({ goals })
})

// New API: Create goal for set
app.post('/api/sets/:id/goals', async (c) => {
  try {
    const setId = c.req.param('id')
    const { stat, min_boost, max_cost, preferred_slots, include_nugget_price } = await c.req.json()
    
    if (!stat || min_boost === undefined || min_boost === null) {
      return c.json({ error: 'stat and min_boost required' }, 400)
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO set_goals (set_id, stat, min_boost, max_cost, preferred_slots, include_nugget_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(setId, stat, min_boost, max_cost || null, preferred_slots || null, include_nugget_price || 0, new Date().toISOString()).run()

    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (error) {
    console.error('Error adding goal:', error)
    return c.json({ error: (error as Error).message || 'Failed to add goal' }, 500)
  }
})

// New API: Get inventory for set
app.get('/api/sets/:id/inventory', async (c) => {
  const setId = c.req.param('id')
  
  const { results: inventory } = await c.env.DB.prepare('SELECT * FROM set_inventory WHERE set_id = ?')
    .bind(setId)
    .all()

  return c.json({ inventory })
})

// New API: Add item to set inventory
app.post('/api/sets/:id/inventory', async (c) => {
  try {
    const setId = c.req.param('id')
    const { item_name, slot, enhancives_json, is_permanent } = await c.req.json()
    
    if (!item_name || !slot || !enhancives_json) {
      return c.json({ error: 'item_name, slot, and enhancives_json required' }, 400)
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO set_inventory (set_id, item_name, slot, enhancives_json, is_permanent, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(setId, item_name, slot, enhancives_json, is_permanent ? 1 : 0, new Date().toISOString()).run()

    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (error) {
    console.error('Error adding inventory:', error)
    return c.json({ error: (error as Error).message || 'Failed to add item' }, 500)
  }
})

// Copy inventory from another set
app.post('/api/sets/:id/inventory/copy', async (c) => {
  try {
    const targetSetId = c.req.param('id')
    const { source_set_id } = await c.req.json()
    
    if (!source_set_id) {
      return c.json({ error: 'source_set_id required' }, 400)
    }

    const { results: items } = await c.env.DB.prepare('SELECT item_name, slot, enhancives_json, is_permanent FROM set_inventory WHERE set_id = ?')
      .bind(source_set_id).all()

    let count = 0
    for (const item of items) {
      await c.env.DB.prepare('INSERT INTO set_inventory (set_id, item_name, slot, enhancives_json, is_permanent, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(targetSetId, item.item_name, item.slot, item.enhancives_json, item.is_permanent, new Date().toISOString()).run()
      count++
    }

    return c.json({ success: true, count })
  } catch (error) {
    console.error('Error copying inventory:', error)
    return c.json({ error: (error as Error).message || 'Failed to copy inventory' }, 500)
  }
})

// Legacy: character_sets endpoints (keep during transition)
app.get('/api/character-sets', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const { results: sets } = await c.env.DB.prepare('SELECT * FROM character_sets WHERE discord_id = ?')
    .bind(discordId)
    .all()

  return c.json({ sets })
})

// Legacy: Keep for backwards compatibility during transition
app.get('/api/goals', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const { results } = await c.env.DB.prepare('SELECT * FROM user_goals WHERE discord_id = ?')
    .bind(discordId)
    .all()

  return c.json({ goals: results })
})

// New API: Create character set
app.post('/api/character-sets', async (c) => {
  const { discord_id, set_name, account_type } = await c.req.json()
  
  if (!discord_id || !set_name) {
    return c.json({ error: 'discord_id and set_name required' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO character_sets (discord_id, set_name, account_type, created_at) VALUES (?, ?, ?, ?)'
  ).bind(discord_id, set_name, account_type || 'F2P', new Date().toISOString()).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// New API: Update character set
app.put('/api/character-sets/:id', async (c) => {
  const id = c.req.param('id')
  const { set_name, account_type, base_stats, skill_ranks } = await c.req.json()

  await c.env.DB.prepare(
    'UPDATE character_sets SET set_name = ?, account_type = ?, base_stats = ?, skill_ranks = ? WHERE id = ?'
  ).bind(set_name, account_type, base_stats || null, skill_ranks || null, id).run()

  return c.json({ success: true })
})

// New API: Delete character set (cascades to goals and inventory)
app.delete('/api/character-sets/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM character_sets WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// New API: Get goals for a character set
app.get('/api/character-sets/:id/goals', async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare('SELECT * FROM set_goals WHERE character_set_id = ?')
    .bind(id)
    .all()
  return c.json({ goals: results })
})

// New API: Add goal to character set
app.post('/api/character-sets/:id/goals', async (c) => {
  const setId = c.req.param('id')
  const { stat, min_boost, max_cost, preferred_slots } = await c.req.json()
  
  if (!stat || min_boost === undefined || min_boost === null) {
    return c.json({ error: 'stat and min_boost required' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO set_goals (character_set_id, stat, min_boost, max_cost, preferred_slots, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(setId, stat, min_boost, max_cost || null, preferred_slots || null, new Date().toISOString()).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// DEPRECATED: Legacy endpoints for old schema (user_goals, user_inventory)
// These tables don't exist in production - use new endpoints instead:
// - POST /api/sets/:id/goals
// - PUT /api/set-goals/:id
// - POST /api/sets/:id/inventory

// New API: Get single goal
app.get('/api/set-goals/:id', async (c) => {
  const id = c.req.param('id')
  const goal = await c.env.DB.prepare('SELECT * FROM set_goals WHERE id = ?').bind(id).first()
  return c.json({ goal })
})

// New API: Update goal
app.put('/api/set-goals/:id', async (c) => {
  const id = c.req.param('id')
  const { stat, min_boost, max_cost, preferred_slots, include_nugget_price } = await c.req.json()
  
  if (!stat || min_boost === undefined || min_boost === null) {
    return c.json({ error: 'stat and min_boost required' }, 400)
  }

  await c.env.DB.prepare(
    'UPDATE set_goals SET stat = ?, min_boost = ?, max_cost = ?, preferred_slots = ?, include_nugget_price = ? WHERE id = ?'
  ).bind(stat, min_boost, max_cost || null, preferred_slots || null, include_nugget_price || 0, id).run()

  return c.json({ success: true })
})

// New API: Delete goal from set
app.delete('/api/set-goals/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM set_goals WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// Legacy: Keep for backwards compatibility
app.delete('/api/goals/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM user_goals WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.get('/api/my-matches', async (c) => {
  const discordId = c.req.query('discord_id')
  const setName = c.req.query('set_name')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

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

  let filtered = results
  
  // Filter by set goals if set_name provided
  if (setName) {
    const setResult = await c.env.DB.prepare('SELECT s.id FROM sets s JOIN characters ch ON s.character_id = ch.id WHERE ch.discord_id = ? AND s.set_name = ?').bind(discordId, setName).first()
    if (setResult) {
      const { results: goals } = await c.env.DB.prepare('SELECT stat FROM set_goals WHERE set_id = ?').bind(setResult.id).all()
      const goalStats = new Set(goals.map((g: any) => g.stat))
      filtered = results.filter((r: any) => {
        const enhs = JSON.parse(r.enhancives_json || '[]')
        return enhs.some((e: any) => goalStats.has(e.ability))
      })
    }
  }

  const available = filtered.filter((r: any) => r.available === 1)
  const recentlySold = filtered.filter((r: any) => r.available === 0)

  return c.json({ available, recentlySold })
})

app.post('/api/ai-chat', async (c) => {
  const { message, discord_id, history } = await c.req.json()
  if (!message || !discord_id) return c.json({ error: 'message and discord_id required' }, 400)
  
  const callCount = (history || []).length / 2
  if (callCount > 50) {
    return c.json({ error: 'Rate limit: Maximum 50 messages per session. Please refresh to start a new session.' }, 429)
  }
  
  // Get database schema
  const schemaResult = await c.env.DB.prepare(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='shop_items'
  `).first()
  
  const schemaContext = schemaResult ? `\n\nDatabase Schema:\n${schemaResult.sql}` : ''
  
  const goalsResult = await c.env.DB.prepare(`
    SELECT sg.stat, sg.min_boost, sg.max_cost, sg.preferred_slots 
    FROM set_goals sg
    JOIN sets s ON sg.set_id = s.id
    JOIN characters c ON s.character_id = c.id
    WHERE c.discord_id = ?
  `).bind(discord_id).all()
  let goalsContext = ''
  if (goalsResult.results.length > 0) {
    goalsContext = ` User goals: ${goalsResult.results.map(g => `${g.stat} +${g.min_boost} under ${g.max_cost} silvers${g.preferred_slots ? ` in slots ${g.preferred_slots}` : ''}`).join(', ')}.`
  }
  
  const invResult = await c.env.DB.prepare(`
    SELECT si.item_name, si.slot, si.enhancives_json 
    FROM set_inventory si
    JOIN sets s ON si.set_id = s.id
    JOIN characters c ON s.character_id = c.id
    WHERE c.discord_id = ?
  `).bind(discord_id).all()
  let invContext = ''
  if (invResult.results.length > 0) {
    invContext = ` User inventory: ${invResult.results.map(i => `${i.item_name} (${i.slot})`).join(', ')}.`
  }
  
  const summaryResponse = await fetch(`${c.req.url.replace('/api/ai-chat', '/api/summary')}?discord_id=${discord_id}&goal_set_name=Default`)
  let statsContext = ''
  if (summaryResponse.ok) {
    const summaryData = await summaryResponse.json() as { stats?: Record<string, any>; skills?: Record<string, any> }
    const needs = []
    for (const stat in summaryData.stats) {
      const s = summaryData.stats[stat]
      if (s.enhancive < s.cap) needs.push(`${stat} needs +${s.cap - s.enhancive}`)
    }
    for (const skill in summaryData.skills) {
      const sk = summaryData.skills[skill]
      if (sk.enhancive < sk.cap) needs.push(`${skill} needs +${sk.cap - sk.enhancive}`)
    }
    if (needs.length > 0) statsContext = ` To cap: ${needs.join(', ')}.`
  }
  
  let itemsContext = ''
  const lowerMsg = message.toLowerCase()
  const stats = ['strength', 'constitution', 'dexterity', 'agility', 'discipline', 'aura', 'logic', 'intuition', 'wisdom', 'influence']
  const matchedStat = stats.find(s => lowerMsg.includes(s))
  
  if (matchedStat && (lowerMsg.includes('show') || lowerMsg.includes('find') || lowerMsg.includes('search') || lowerMsg.includes('item'))) {
    const itemsQuery = await c.env.DB.prepare(
      "SELECT name, town, cost, worn, enhancives_json FROM shop_items WHERE available = 1 AND enhancives_json LIKE ? LIMIT 10"
    ).bind(`%${matchedStat.charAt(0).toUpperCase()}${matchedStat.slice(1)}%`).all()
    
    if (itemsQuery.results.length > 0) {
      itemsContext = ` Available ${matchedStat} items: ${itemsQuery.results.map((item: any) => {
        const enhs = JSON.parse(item.enhancives_json)
        const enhText = enhs.map((e: any) => `+${e.boost} ${e.ability}`).join(', ')
        return `${item.name} (${item.worn}) - ${item.cost ? item.cost.toLocaleString() : '?'} silvers in ${item.town} - ${enhText}`
      }).join('; ')}.`
    }
  }
  
  const systemPrompt = `You are a SQL query generator for GS4 Enhancive Shopper. Generate SQLite queries based on user requests.\n\n${schemaContext}\n\nIMPORTANT:\n- enhancives_json is TEXT (not JSON type) - use LIKE for searching\n- ALWAYS include: WHERE available = 1\n- Use LIKE '%pattern%' for text search in enhancives_json\n- NO PostgreSQL syntax (no ::jsonb, no ->, no ->>) \n- Sort by cost ASC (cheapest first) unless user asks for "highest/best/most"\n\nCommon slots: neck, finger, fingers, wrist, head, ear, ears, waist, arms, legs, feet, shoulder, shoulders, back, chest, front, hands, hair, ankle, pin\n\nCommon stats: Strength, Constitution, Dexterity, Agility, Discipline, Aura, Logic, Intuition, Wisdom, Influence\n\nExamples:\n- "neck wisdom items" → SELECT name, town, shop, cost, worn, enhancives_json FROM shop_items WHERE available = 1 AND worn = 'neck' AND enhancives_json LIKE '%Wisdom%' ORDER BY cost ASC LIMIT 10;\n- "cheap strength under 5M" → SELECT name, town, shop, cost, worn, enhancives_json FROM shop_items WHERE available = 1 AND enhancives_json LIKE '%Strength%' AND cost < 5000000 ORDER BY cost ASC LIMIT 10;\n\nRespond with ONLY the SQL query, nothing else.${goalsContext}${invContext}${statsContext}${itemsContext}`
  
  const messages = [{ role: 'system', content: systemPrompt }]
  if (history && history.length > 0) {
    messages.push(...history)
  }
  
  try {
    const aiResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages })
    let responseText = aiResponse.response
    
    const sqlMatch = responseText.match(/SELECT[\s\S]*?FROM[\s\S]*?;/i)
    if (sqlMatch) {
      let sql = sqlMatch[0]
      
      // If user asked for "highest/best/most", fetch more items so we can sort properly
      const userMessage = (messages[messages.length - 1]?.content || '').toLowerCase()
      if (userMessage.includes('highest') || userMessage.includes('best') || userMessage.includes('most')) {
        sql = sql.replace(/LIMIT\s+\d+/i, 'LIMIT 50')
      }
      
      if (sql.toLowerCase().includes('select') && sql.toLowerCase().includes('from shop_items')) {
        try {
          const queryResult = await c.env.DB.prepare(sql).all()
          if (queryResult.results.length > 0) {
            let results = queryResult.results
            
            // Get user message once
            const userMessage = (messages[messages.length - 1]?.content || '').toLowerCase()
            
            // Detect if user wants minimum total (e.g., "at least 20 wisdom")
            const minTotalMatch = userMessage.match(/(?:at least|minimum|min|total of)\s+(\d+)/i)
            const minTotal = minTotalMatch ? parseInt(minTotalMatch[1], 10) : 0
            
            // If user asked for "highest" or "best", sort by total boost of the stat they're searching for
            if (userMessage.includes('highest') || userMessage.includes('best') || userMessage.includes('most') || minTotal > 0) {
              // Try to detect which stat they want
              const stats = ['wisdom', 'strength', 'constitution', 'dexterity', 'agility', 'discipline', 'aura', 'logic', 'intuition', 'influence']
              const targetStat = stats.find(s => userMessage.includes(s))
              
              if (targetStat) {
                results = results.map((item: any) => {
                  const enhs = JSON.parse(item.enhancives_json || '[]')
                  const total = enhs
                    .filter((e: any) => e.ability.toLowerCase().includes(targetStat))
                    .reduce((sum: number, e: any) => sum + e.boost, 0)
                  return { ...item, _sortValue: total }
                })
                
                // Filter by minimum total if specified
                if (minTotal > 0) {
                  results = results.filter((item: any) => item._sortValue >= minTotal)
                }
                
                // Sort by highest total
                results = results.sort((a: any, b: any) => b._sortValue - a._sortValue)
              }
            }
            
            // Try to detect how many items user wants
            const numberMatch = userMessage.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/)
            let displayLimit = 5
            if (numberMatch) {
              const numMap: any = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
              displayLimit = numMap[numberMatch[1]] || parseInt(numberMatch[1], 10) || 5
            }
            
            if (results.length === 0) {
              responseText = 'No items found matching your criteria.'
              return c.json({ response: responseText, sql: sql })
            }
            
            const itemList = results.slice(0, displayLimit).map((item: any) => {
              const enhs = JSON.parse(item.enhancives_json || '[]')
              const enhText = enhs.map((e: any) => `+${e.boost} ${e.ability}`).join(', ')
              const totalBadge = item._sortValue ? ` [Total: +${item._sortValue}]` : ''
              return `${item.name} - ${item.cost ? `${item.cost.toLocaleString()} silvers` : 'unknown cost'} - ${item.town} - ${enhText}${totalBadge}`
            }).join('\n')
            
            // Don't show the SQL query in the response, but include it for debugging
            responseText = `Found ${results.length} items:\n${itemList}`
            if (results.length > displayLimit) responseText += `\n... and ${results.length - displayLimit} more`
            
            // Return SQL query separately so it can be logged on client side
            return c.json({ response: responseText, sql: sql })
          } else {
            responseText += '\n\nNo items found.'
          }
        } catch (_e) {
          responseText += '\n\n(Query error)'
        }
      }
    }
    
    return c.json({ response: responseText })
  } catch (error) {
    console.error('AI error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `AI request failed: ${errorMsg}. Please try again or rephrase your question.` }, 500)
  }
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

    const channel = await sent.json() as { id?: string }
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

app.get('/api/debug/migration', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const { results: oldSets } = await c.env.DB.prepare('SELECT * FROM character_sets WHERE discord_id = ?').bind(discordId).all()
  const { results: characters } = await c.env.DB.prepare('SELECT * FROM characters WHERE discord_id = ?').bind(discordId).all()
  const { results: sets } = await c.env.DB.prepare('SELECT s.* FROM sets s JOIN characters c ON s.character_id = c.id WHERE c.discord_id = ?').bind(discordId).all()
  const { results: goals } = await c.env.DB.prepare('SELECT * FROM set_goals WHERE set_id IS NOT NULL').all()
  const { results: inventory } = await c.env.DB.prepare('SELECT * FROM set_inventory WHERE set_id IS NOT NULL').all()

  return c.json({ 
    oldSets,
    characters,
    sets,
    goalsCount: goals.length,
    inventoryCount: inventory.length
  })
})

app.get('/api/debug/sets', async (c) => {
  const discordId = c.req.query('discord_id')
  if (!discordId) return c.json({ error: 'discord_id required' }, 400)

  const { results: goals } = await c.env.DB.prepare('SELECT DISTINCT goal_set_name FROM user_goals WHERE discord_id = ?').bind(discordId).all()
  const { results: inventory } = await c.env.DB.prepare('SELECT DISTINCT goal_set_name FROM user_inventory WHERE discord_id = ?').bind(discordId).all()
  
  return c.json({ 
    setsWithGoals: goals.map(r => r.goal_set_name),
    setsWithInventory: inventory.map(r => r.goal_set_name)
  })
})

        const enhancives = JSON.parse(item.enhancives_json as string)
        const hasMatch = enhancives.some((enh: any) => 
          enh.ability.toLowerCase().includes((goal.stat as string).toLowerCase()) && enh.boost >= (goal.min_boost as number)
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

// DEPRECATED: Legacy inventory endpoint (user_inventory table doesn't exist)
// Use POST /api/sets/:id/inventory instead

// New API: Get inventory for character set
app.get('/api/character-sets/:id/inventory', async (c) => {
  const setId = c.req.param('id')
  
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM set_inventory WHERE character_set_id = ?'
  ).bind(setId).all()

  return c.json({ items: results })
})

// New API: Add item to character set inventory
app.post('/api/character-sets/:id/inventory', async (c) => {
  const setId = c.req.param('id')
  const { item_name, slot, enhancives_json, is_permanent } = await c.req.json()
  
  if (!item_name || !slot || !enhancives_json) {
    return c.json({ error: 'item_name, slot, and enhancives_json required' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO set_inventory (character_set_id, item_name, slot, enhancives_json, is_permanent, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(setId, item_name, slot, enhancives_json, is_permanent ? 1 : 0, new Date().toISOString()).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// New API: Update inventory item
app.put('/api/set-inventory/:id', async (c) => {
  const id = c.req.param('id')
  const { item_name, slot, enhancives_json, is_permanent } = await c.req.json()

  await c.env.DB.prepare(
    'UPDATE set_inventory SET item_name = ?, slot = ?, enhancives_json = ?, is_permanent = ? WHERE id = ?'
  ).bind(item_name, slot, enhancives_json, is_permanent ? 1 : 0, id).run()

  return c.json({ success: true })
})

// New API: Delete inventory item
app.get('/api/set-inventory/:id', async (c) => {
  const id = c.req.param('id')
  const item = await c.env.DB.prepare('SELECT * FROM set_inventory WHERE id = ?').bind(id).first()
  return c.json({ item })
})

app.put('/api/set-inventory/:id', async (c) => {
  const id = c.req.param('id')
  const { slot, is_permanent } = await c.req.json()
  
  await c.env.DB.prepare('UPDATE set_inventory SET slot = ?, is_permanent = ? WHERE id = ?')
    .bind(slot, is_permanent ? 1 : 0, id)
    .run()
  
  return c.json({ success: true })
})

app.delete('/api/set-inventory/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM set_inventory WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// Delete all inventory items for a set
app.delete('/api/sets/:setId/inventory', async (c) => {
  const setId = c.req.param('setId')
  await c.env.DB.prepare('DELETE FROM set_inventory WHERE set_id = ?').bind(setId).run()
  return c.json({ success: true })
})

// Legacy: Keep for backwards compatibility
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

// DEPRECATED: Legacy irreplaceable endpoint (user_inventory table doesn't exist)
// Use PUT /api/inventory/:id/irreplaceable with set_inventory table instead

// Get recommendations for a character set
app.get('/api/recommendations/:discord_id/:goal_set', async (c) => {
  try {
    const discordId = c.req.param('discord_id')
    const goalSetName = c.req.param('goal_set')
    
    const cacheResult = await c.env.DB.prepare('SELECT recommendations_json, calculated_at FROM recommendation_cache WHERE discord_id = ? AND goal_set_name = ? AND datetime(calculated_at) > datetime("now", "-1 hour")')
      .bind(discordId, goalSetName).first()
    
    if (cacheResult) {
      return c.json(JSON.parse(cacheResult.recommendations_json as string))
    }
    
    const setResult = await c.env.DB.prepare(`
      SELECT s.id, s.account_type 
      FROM sets s
      JOIN characters ch ON s.character_id = ch.id
      WHERE ch.discord_id = ? AND s.set_name = ?
    `).bind(discordId, goalSetName).first()
    
    if (!setResult) {
      return c.json({ error: 'Set not found' }, 404)
    }
    
    const { results: goals } = await c.env.DB.prepare('SELECT * FROM set_goals WHERE set_id = ?').bind(setResult.id).all()
    const { results: inventory } = await c.env.DB.prepare('SELECT * FROM set_inventory WHERE set_id = ?').bind(setResult.id).all()
    const { results: rawItems } = await c.env.DB.prepare('SELECT * FROM shop_items').all()
    
    const items = (rawItems as any[]).map(item => ({ ...item, slot: item.worn, price: item.cost, item_name: item.name }))
    
    const slotUsage: Record<string, number> = {}
    for (const item of inventory as any[]) {
      slotUsage[item.slot] = (slotUsage[item.slot] || 0) + 1
    }
    
    const direct = findDirectMatches(items as any, goals as any, slotUsage, setResult.account_type as string)
    const nuggets = findNuggetOpportunities(items as any, goals as any, slotUsage, setResult.account_type as string)
    const swatches = findSwatchOpportunities(items as any, goals as any, slotUsage, setResult.account_type as string)
    const swaps = findSimpleSwaps(inventory as any, items as any, goals as any)
    
    const recommendations = { direct, nuggets, swatches, swaps }
    
    await c.env.DB.prepare('INSERT OR REPLACE INTO recommendation_cache (discord_id, goal_set_name, recommendations_json, calculated_at) VALUES (?, ?, ?, datetime("now"))')
      .bind(discordId, goalSetName, JSON.stringify(recommendations)).run()
    
    return c.json(recommendations)
  } catch (error: any) {
    console.error('Recommendations error:', error)
    return c.json({ error: error.message, stack: error.stack }, 500)
  }
})

app.delete('/api/recommendations/:discord_id/:goal_set', async (c) => {
  const discordId = c.req.param('discord_id')
  const goalSetName = c.req.param('goal_set')
  
  await c.env.DB.prepare('DELETE FROM recommendation_cache WHERE discord_id = ? AND goal_set_name = ?')
    .bind(discordId, goalSetName).run()
  
  return c.json({ success: true })
})

// Migration endpoint - run once to migrate old schema to new
app.get('/api/migrate-old-to-new', async (c) => {
  // First check if old tables exist
  const tableCheck = await c.env.DB.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user_goals', 'user_inventory', 'character_sets')
  `).all()
  
  if (tableCheck.results.length === 0) {
    return c.json({
      success: true,
      message: 'Old tables do not exist - migration not needed or already completed',
      oldTablesFound: []
    })
  }
  
  const { migrateToNewSchema } = await import('./migrate-to-new-schema')
  const result = await migrateToNewSchema(c.env.DB)
  return c.json(result)
})

// Debug endpoint - check database schema and data
app.get('/api/debug/schema', async (c) => {
  try {
    const tables = await c.env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all()
    
    const counts: any = {}
    for (const table of tables.results) {
      const tableName = (table as any).name
      try {
        const count = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).first()
        counts[tableName] = (count as any)?.count || 0
      } catch (e: any) {
        counts[tableName] = `Error: ${e.message}`
      }
    }
    
    return c.json({
      tables: tables.results.map((t: any) => t.name),
      rowCounts: counts
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Migration endpoint - visit once to migrate to new schema
app.get('/api/migrate-schema', async (c) => {
  try {
    await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS character_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT NOT NULL, set_name TEXT NOT NULL, account_type TEXT DEFAULT 'F2P', base_stats TEXT, skill_ranks TEXT, created_at TEXT NOT NULL, UNIQUE(discord_id, set_name))`).run()
    await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS set_inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, character_set_id INTEGER NOT NULL, item_name TEXT NOT NULL, slot TEXT NOT NULL, enhancives_json TEXT NOT NULL, is_permanent INTEGER DEFAULT 0, created_at TEXT NOT NULL, FOREIGN KEY (character_set_id) REFERENCES character_sets(id) ON DELETE CASCADE)`).run()
    await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS set_goals (id INTEGER PRIMARY KEY AUTOINCREMENT, character_set_id INTEGER NOT NULL, stat TEXT NOT NULL, min_boost INTEGER NOT NULL, max_cost INTEGER, preferred_slots TEXT, created_at TEXT NOT NULL, FOREIGN KEY (character_set_id) REFERENCES character_sets(id) ON DELETE CASCADE)`).run()
    await c.env.DB.prepare(`INSERT INTO character_sets (discord_id, set_name, account_type, base_stats, skill_ranks, created_at) SELECT discord_id, COALESCE(goal_set_name, 'Default') as set_name, COALESCE(account_type, 'F2P') as account_type, base_stats, skill_ranks, MIN(created_at) as created_at FROM user_goals GROUP BY discord_id, COALESCE(goal_set_name, 'Default')`).run()
    await c.env.DB.prepare(`INSERT INTO set_inventory (character_set_id, item_name, slot, enhancives_json, is_permanent, created_at) SELECT cs.id, ui.item_name, ui.slot, ui.enhancives_json, ui.is_permanent, ui.created_at FROM user_inventory ui JOIN character_sets cs ON cs.discord_id = ui.discord_id AND cs.set_name = ui.goal_set_name`).run()
    await c.env.DB.prepare(`INSERT INTO set_goals (character_set_id, stat, min_boost, max_cost, preferred_slots, created_at) SELECT cs.id, ug.stat, ug.min_boost, ug.max_cost, ug.preferred_slots, ug.created_at FROM user_goals ug JOIN character_sets cs ON cs.discord_id = ug.discord_id AND cs.set_name = COALESCE(ug.goal_set_name, 'Default') WHERE ug.stat != '_placeholder'`).run()
    return c.json({ success: true, message: 'Migration completed' })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

app.get('/api/migrate-hierarchy', async (c) => {
  try {
    await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS characters (id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT NOT NULL, character_name TEXT NOT NULL, base_stats TEXT, skill_ranks TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(discord_id, character_name))`).run()
    await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS sets (id INTEGER PRIMARY KEY AUTOINCREMENT, character_id INTEGER NOT NULL, set_name TEXT NOT NULL, account_type TEXT DEFAULT 'F2P', created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE, UNIQUE(character_id, set_name))`).run()
    await c.env.DB.prepare(`INSERT INTO characters (discord_id, character_name, base_stats, skill_ranks, created_at) SELECT discord_id, set_name as character_name, base_stats, skill_ranks, created_at FROM character_sets WHERE true ON CONFLICT(discord_id, character_name) DO NOTHING`).run()
    await c.env.DB.prepare(`INSERT INTO sets (character_id, set_name, account_type, created_at) SELECT c.id as character_id, 'Default' as set_name, cs.account_type, cs.created_at FROM character_sets cs JOIN characters c ON c.discord_id = cs.discord_id AND c.character_name = cs.set_name`).run()
    await c.env.DB.prepare(`ALTER TABLE set_goals ADD COLUMN set_id INTEGER`).run()
    await c.env.DB.prepare(`UPDATE set_goals SET set_id = (SELECT s.id FROM sets s JOIN characters c ON s.character_id = c.id JOIN character_sets cs ON cs.discord_id = c.discord_id AND cs.set_name = c.character_name WHERE set_goals.character_set_id = cs.id)`).run()
    await c.env.DB.prepare(`ALTER TABLE set_inventory ADD COLUMN set_id INTEGER`).run()
    await c.env.DB.prepare(`UPDATE set_inventory SET set_id = (SELECT s.id FROM sets s JOIN characters c ON s.character_id = c.id JOIN character_sets cs ON cs.discord_id = c.discord_id AND cs.set_name = c.character_name WHERE set_inventory.character_set_id = cs.id)`).run()
    return c.json({ success: true, message: 'Hierarchy migration completed' })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

app.get('/api/fix-nullable-columns', async (c) => {
  try {
    await c.env.DB.prepare(`PRAGMA foreign_keys = OFF`).run()
    
    await c.env.DB.batch([
      c.env.DB.prepare(`CREATE TABLE set_inventory_new (id INTEGER PRIMARY KEY AUTOINCREMENT, character_set_id INTEGER, set_id INTEGER, item_name TEXT NOT NULL, slot TEXT NOT NULL, enhancives_json TEXT NOT NULL, is_permanent INTEGER DEFAULT 0, created_at TEXT NOT NULL)`),
      c.env.DB.prepare(`INSERT INTO set_inventory_new SELECT * FROM set_inventory`),
      c.env.DB.prepare(`DROP TABLE set_inventory`),
      c.env.DB.prepare(`ALTER TABLE set_inventory_new RENAME TO set_inventory`),
      c.env.DB.prepare(`CREATE TABLE set_goals_new (id INTEGER PRIMARY KEY AUTOINCREMENT, character_set_id INTEGER, set_id INTEGER, stat TEXT NOT NULL, min_boost INTEGER NOT NULL, max_cost INTEGER, preferred_slots TEXT, created_at TEXT NOT NULL)`),
      c.env.DB.prepare(`INSERT INTO set_goals_new SELECT * FROM set_goals`),
      c.env.DB.prepare(`DROP TABLE set_goals`),
      c.env.DB.prepare(`ALTER TABLE set_goals_new RENAME TO set_goals`)
    ])
    
    await c.env.DB.prepare(`PRAGMA foreign_keys = ON`).run()
    
    return c.json({ success: true, message: 'Columns made nullable' })
  } catch (error: any) {
    await c.env.DB.prepare(`PRAGMA foreign_keys = ON`).run()
    return c.json({ success: false, error: error.message }, 500)
  }
})

app.get('/api/summary', async (c) => {
  const setId = c.req.query('set_id')
  
  if (!setId) {
    return c.json({ error: 'set_id required' }, 400)
  }

  const set = await c.env.DB.prepare(
    'SELECT character_id FROM sets WHERE id = ?'
  ).bind(setId).first()

  if (!set) {
    return c.json({ error: 'Set not found' }, 404)
  }

  const character = await c.env.DB.prepare(
    'SELECT base_stats, skill_ranks FROM characters WHERE id = ?'
  ).bind(set.character_id).first()

  const baseStats = character?.base_stats ? JSON.parse(character.base_stats as string) : {}
  const skillRanks = character?.skill_ranks ? JSON.parse(character.skill_ranks as string) : {}

  const { results: items } = await c.env.DB.prepare(
    'SELECT enhancives_json FROM set_inventory WHERE set_id = ?'
  ).bind(setId).all()

  const stats: Record<string, { base: number; enhancive: number; total: number; cap: number }> = {}
  const skills: Record<string, { base: number; enhancive: number; total: number; cap: number }> = {}

  for (const item of items) {
    const enhancives = JSON.parse(item.enhancives_json as string)
    for (const enh of enhancives) {
      const { ability, boost } = enh
      const _isBase = ability.includes('Base')
      const isBonus = ability.includes('Bonus')
      const isRanks = ability.includes('Ranks')
      
      const cleanName = ability.replace(/ (Base|Bonus|Ranks)/g, '').replace(/\s*\([A-Z]+\)/g, '').trim()
      const isStat = ['Strength', 'Constitution', 'Dexterity', 'Agility', 'Discipline', 'Aura', 'Logic', 'Intuition', 'Wisdom', 'Influence'].includes(cleanName)
      
      if (isStat) {
        if (!stats[cleanName]) stats[cleanName] = { base: baseStats[cleanName] || 0, enhancive: 0, total: 0, cap: STAT_CAP }
        stats[cleanName].enhancive += isBonus ? boost * 2 : boost
      } else {
        if (!skills[cleanName]) skills[cleanName] = { base: skillRanks[cleanName] || 0, enhancive: 0, total: 0, cap: SKILL_CAP }
        if (isRanks) {
          skills[cleanName].enhancive += ranksToBonus(boost, skills[cleanName].base)
        } else {
          skills[cleanName].enhancive += boost
        }
      }
    }
  }

  for (const stat in stats) {
    stats[stat].total = stats[stat].base + stats[stat].enhancive
  }
  for (const skill in skills) {
    skills[skill].total = skills[skill].base + skills[skill].enhancive
  }

  return c.json({ stats, skills })
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
    
    // Update existing items that are still available
    const existingAvailableItems = items.filter(item => existingIds.has(item.id))
    
    if (existingAvailableItems.length > 0) {
      const updateStmt = c.env.DB.prepare(
        `UPDATE shop_items SET last_seen = ?, is_permanent = ?, available = 1 WHERE id = ?`
      )
      
      const updateBatch = existingAvailableItems.map(item =>
        updateStmt.bind(now, item.is_permanent ? 1 : 0, item.id)
      )
      
      await c.env.DB.batch(updateBatch)
      console.log(`Updated ${existingAvailableItems.length} existing items`)
    }
    
    if (newItems.length > 0) {
      const stmt = c.env.DB.prepare(
        `INSERT INTO shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at, last_seen, available, is_permanent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
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
          now,
          item.is_permanent ? 1 : 0
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

async function runScrape(env: Env): Promise<{ status: string; detail?: string }> {
  const BATCH_SIZE = 400
  const start = Date.now()
  let status = 'error'
  let detail = ''
  let itemsTotal = 0, itemsNew = 0, itemsRemoved = 0

  try {
    const lastUpdated = await getLastUpdated()
    if (!lastUpdated) {
      status = 'no_timestamp'
      detail = 'getLastUpdated returned null'
      return { status, detail }
    }

    const { results } = await env.DB.prepare('SELECT value FROM metadata WHERE key = ?')
      .bind('last_updated').all()
    const stored = results[0]?.value as string | undefined

    if (stored === lastUpdated) {
      status = 'no_change'
      detail = `stored=${stored}, remote=${lastUpdated}`
      // Cleanup items unavailable for 72+ hours
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
      const { meta } = await env.DB.prepare('DELETE FROM shop_items WHERE available = 0 AND unavailable_since < ?').bind(cutoff).run()
      if (meta.changes > 0) console.log(`Cleaned up ${meta.changes} items older than 72 hours`)
      return { status, detail }
    }

    console.log('Update detected, scraping...')
    const items = await scrapeEnhancives()
    const now = new Date().toISOString()
    itemsTotal = items.length

    const { results: existingItems } = await env.DB.prepare('SELECT id FROM shop_items WHERE available = 1').all()
    const existingIds = new Set(existingItems.map((i: any) => i.id))
    const scrapedIds = new Set(items.map(i => i.id))

    const removedIds = [...existingIds].filter(id => !scrapedIds.has(id))
    itemsRemoved = removedIds.length
    for (let i = 0; i < removedIds.length; i += BATCH_SIZE) {
      const chunk = removedIds.slice(i, i + BATCH_SIZE)
      const placeholders = chunk.map(() => '?').join(',')
      await env.DB.prepare(`UPDATE shop_items SET available = 0, unavailable_since = ? WHERE id IN (${placeholders})`)
        .bind(now, ...chunk).run()
    }

    const newItems = items.filter(item => !existingIds.has(item.id))
    itemsNew = newItems.length
    const existingAvailableItems = items.filter(item => existingIds.has(item.id))

    if (existingAvailableItems.length > 0) {
      const updateStmt = env.DB.prepare('UPDATE shop_items SET last_seen = ?, is_permanent = ?, available = 1 WHERE id = ?')
      for (let i = 0; i < existingAvailableItems.length; i += BATCH_SIZE) {
        const chunk = existingAvailableItems.slice(i, i + BATCH_SIZE)
        await env.DB.batch(chunk.map(item => updateStmt.bind(now, item.is_permanent ? 1 : 0, item.id)))
      }
    }

    if (newItems.length > 0) {
      const stmt = env.DB.prepare(
        `INSERT OR REPLACE INTO shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at, last_seen, available, is_permanent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      )
      for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
        const chunk = newItems.slice(i, i + BATCH_SIZE)
        await env.DB.batch(chunk.map(item => stmt.bind(
          item.id, item.name, item.town, item.shop, item.cost,
          item.enchant, item.worn, JSON.stringify(item.enhancives), now, now, item.is_permanent ? 1 : 0
        )))
      }
    }

    await checkMatches(env, newItems)

    await env.DB.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)')
      .bind('last_updated', lastUpdated).run()

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    const { meta } = await env.DB.prepare('DELETE FROM shop_items WHERE available = 0 AND unavailable_since < ?').bind(cutoff).run()
    if (meta.changes > 0) console.log(`Cleaned up ${meta.changes} items older than 72 hours`)

    status = 'updated'
    detail = `${itemsTotal} total, ${itemsNew} new, ${itemsRemoved} removed`
    return { status, detail }
  } catch (error) {
    status = 'error'
    detail = String(error)
    console.error('Scheduled scrape error:', error)
    // Alert admin on failure
    await sendDiscordDM(env.DISCORD_BOT_TOKEN, ADMIN_DISCORD_ID,
      `⚠️ **Scrape Failed**\n\`\`\`${detail.slice(0, 500)}\`\`\`\nTime: ${new Date().toISOString()}`)
    return { status, detail }
  } finally {
    const duration = Date.now() - start
    await env.DB.prepare(
      'INSERT INTO scrape_log (ran_at, status, detail, duration_ms, items_total, items_new, items_removed) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(new Date().toISOString(), status, detail, duration, itemsTotal, itemsNew, itemsRemoved).run()
  }
}

export default {
  fetch: app.fetch,
  
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await runScrape(env)
  },
}
