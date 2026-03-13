// Recommendation Engine for Enhancive Item Optimization
// Implements multi-dimensional knapsack problem with slot constraints

export interface InventoryItem {
  id: number
  item_name: string
  slot: string
  enhancives_json: string
  is_permanent: number
  is_irreplaceable: number
}

export interface Goal {
  stat: string
  min_boost: number
  max_cost: number | null
  preferred_slots: string | null
}

export interface ShopItem {
  item_name: string
  slot: string | null
  price: number
  enhancives_json: string
  available: number
}

export interface SlotUsage {
  [slot: string]: number
}

export interface Recommendation {
  type: 'direct' | 'nugget' | 'swatch' | 'swap'
  item: ShopItem
  totalCost: number
  goalsMatched: string[]
  explanation: string
}

// Slot capacity limits by account type
const SLOT_LIMITS = {
  'F2P': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 1, 'both_ears': 1, 'neck': 3, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 2, 'hands': 1, 'fingers': 2, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 },
  'Premium': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 2, 'both_ears': 2, 'neck': 4, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 3, 'hands': 1, 'fingers': 3, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 },
  'Platinum': { 'pin': 8, 'head': 1, 'hair': 1, 'single_ear': 3, 'both_ears': 3, 'neck': 5, 'shoulder_slung': 2, 'shoulders_draped': 1, 'chest': 1, 'front': 1, 'chest_slipped': 1, 'back': 1, 'arms': 1, 'wrist': 4, 'hands': 1, 'fingers': 4, 'waist': 1, 'belt': 3, 'legs_pulled': 1, 'legs_attached': 1, 'legs_slipped': 1, 'ankle': 1, 'feet_slipped': 1, 'feet_on': 1, 'locus': 1 }
}

const NUGGET_COST = 25000000 // 25M silver
const SWATCH_COST = 25000000 // 25M silver

// Calculate current slot usage from inventory
export function calculateSlotUsage(inventory: InventoryItem[]): SlotUsage {
  const usage: SlotUsage = {}
  for (const item of inventory) {
    usage[item.slot] = (usage[item.slot] || 0) + 1
  }
  return usage
}

// Check if an item can fit in a slot given current usage
export function canFitInSlot(slot: string, slotUsage: SlotUsage, accountType: string = 'F2P'): boolean {
  const limits = SLOT_LIMITS[accountType] || SLOT_LIMITS['F2P']
  const limit = limits[slot] || 0
  const current = slotUsage[slot] || 0
  return current < limit
}

// Calculate how many goals an item matches
export function calculateGoalCoverage(item: ShopItem, goals: Goal[]): string[] {
  const enhancives = JSON.parse(item.enhancives_json)
  const matched: string[] = []
  
  for (const goal of goals) {
    for (const enh of enhancives) {
      if (enh.ability === goal.stat && enh.boost >= goal.min_boost) {
        matched.push(goal.stat)
        break
      }
    }
  }
  
  return matched
}

// Calculate total cost including conversion fees
export function calculateTotalCost(item: ShopItem, conversionType: 'none' | 'nugget' | 'swatch'): number {
  let cost = item.price || 0
  if (conversionType === 'nugget') cost += NUGGET_COST
  if (conversionType === 'swatch') cost += SWATCH_COST
  return cost
}

// Find direct match recommendations (items that match goals and slots)
export function findDirectMatches(
  items: ShopItem[],
  goals: Goal[],
  slotUsage: SlotUsage,
  accountType: string = 'F2P'
): Recommendation[] {
  const recommendations: Recommendation[] = []
  
  for (const item of items) {
    if (!item.available || !item.slot) continue
    
    const goalsMatched = calculateGoalCoverage(item, goals)
    if (goalsMatched.length === 0) continue
    
    // Check if item matches preferred slots for any goal
    let matchesPreferredSlot = false
    for (const goal of goals) {
      if (goalsMatched.includes(goal.stat)) {
        if (!goal.preferred_slots || goal.preferred_slots.includes(item.slot)) {
          matchesPreferredSlot = true
        }
        // Check max cost
        if (goal.max_cost && item.price > goal.max_cost) {
          continue
        }
      }
    }
    
    if (!matchesPreferredSlot) continue
    
    // Check if slot has capacity
    if (!canFitInSlot(item.slot, slotUsage, accountType)) continue
    
    recommendations.push({
      type: 'direct',
      item,
      totalCost: item.price,
      goalsMatched,
      explanation: `Direct match for ${goalsMatched.join(', ')}`
    })
  }
  
  // Sort by cost (lowest first) and return top 10
  return recommendations.sort((a, b) => a.totalCost - b.totalCost).slice(0, 10)
}

// Find nugget conversion opportunities (non-wearable items)
export function findNuggetOpportunities(
  items: ShopItem[],
  goals: Goal[],
  slotUsage: SlotUsage,
  accountType: string = 'F2P'
): Recommendation[] {
  const recommendations: Recommendation[] = []
  
  for (const item of items) {
    if (!item.available || item.slot) continue // Only non-wearable items
    
    const goalsMatched = calculateGoalCoverage(item, goals)
    if (goalsMatched.length === 0) continue
    
    const totalCost = calculateTotalCost(item, 'nugget')
    
    // Check if total cost is within any goal's max cost
    let withinBudget = false
    for (const goal of goals) {
      if (goalsMatched.includes(goal.stat)) {
        if (!goal.max_cost || totalCost <= goal.max_cost) {
          withinBudget = true
          break
        }
      }
    }
    
    if (!withinBudget) continue
    
    recommendations.push({
      type: 'nugget',
      item,
      totalCost,
      goalsMatched,
      explanation: `Convert with nugget (+25M) for ${goalsMatched.join(', ')}`
    })
  }
  
  // Sort by value/cost ratio and return top 10
  return recommendations
    .sort((a, b) => (b.goalsMatched.length / b.totalCost) - (a.goalsMatched.length / a.totalCost))
    .slice(0, 10)
}

// Find swatch conversion opportunities (wrong slot items)
export function findSwatchOpportunities(
  items: ShopItem[],
  goals: Goal[],
  slotUsage: SlotUsage,
  accountType: string = 'F2P'
): Recommendation[] {
  const recommendations: Recommendation[] = []
  
  for (const item of items) {
    if (!item.available || !item.slot) continue
    
    const goalsMatched = calculateGoalCoverage(item, goals)
    if (goalsMatched.length === 0) continue
    
    // Check if item is in wrong slot for any goal
    let needsSwatchForGoal = false
    for (const goal of goals) {
      if (goalsMatched.includes(goal.stat) && goal.preferred_slots) {
        if (!goal.preferred_slots.includes(item.slot)) {
          needsSwatchForGoal = true
          break
        }
      }
    }
    
    if (!needsSwatchForGoal) continue
    
    const totalCost = calculateTotalCost(item, 'swatch')
    
    // Check if total cost is within budget
    let withinBudget = false
    for (const goal of goals) {
      if (goalsMatched.includes(goal.stat)) {
        if (!goal.max_cost || totalCost <= goal.max_cost) {
          withinBudget = true
          break
        }
      }
    }
    
    if (!withinBudget) continue
    
    recommendations.push({
      type: 'swatch',
      item,
      totalCost,
      goalsMatched,
      explanation: `Change slot with swatch (+25M) for ${goalsMatched.join(', ')}`
    })
  }
  
  // Sort by value/cost ratio and return top 10
  return recommendations
    .sort((a, b) => (b.goalsMatched.length / b.totalCost) - (a.goalsMatched.length / a.totalCost))
    .slice(0, 10)
}



