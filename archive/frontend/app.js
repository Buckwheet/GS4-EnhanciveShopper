const API_BASE = 'https://gs4-enhancive-shopper.rpgfilms.workers.dev'

let allItems = []
let filteredItems = []

async function loadItems() {
  try {
    const response = await fetch(`${API_BASE}/api/items`)
    const data = await response.json()
    allItems = data.items || []
    
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

  filteredItems.slice(0, 100).forEach(item => {
    const tr = document.createElement('tr')
    tr.className = 'hover:bg-gray-50'

    let enhancivesText = ''
    try {
      const enhancives = JSON.parse(item.enhancives_json)
      enhancivesText = enhancives.map(e => `+${e.boost} ${e.ability}`).join(', ')
    } catch {
      enhancivesText = 'Error parsing'
    }

    tr.innerHTML = `
      <td class="px-4 py-3">${item.name}</td>
      <td class="px-4 py-3">${item.town}</td>
      <td class="px-4 py-3">${item.shop}</td>
      <td class="px-4 py-3 text-right">${item.cost ? item.cost.toLocaleString() : 'N/A'}</td>
      <td class="px-4 py-3">${item.worn || 'N/A'}</td>
      <td class="px-4 py-3 text-sm">${enhancivesText}</td>
    `
    tbody.appendChild(tr)
  })

  if (filteredItems.length > 100) {
    const tr = document.createElement('tr')
    tr.innerHTML = `<td colspan="6" class="px-4 py-3 text-center text-gray-500">Showing first 100 of ${filteredItems.length} items</td>`
    tbody.appendChild(tr)
  }
}

// Event listeners
document.getElementById('searchName').addEventListener('input', filterItems)
document.getElementById('filterTown').addEventListener('change', filterItems)
document.getElementById('filterWorn').addEventListener('change', filterItems)
document.getElementById('filterStat').addEventListener('change', filterItems)

// Load items on page load
loadItems()
