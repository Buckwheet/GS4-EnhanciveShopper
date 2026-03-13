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
  const limits = SLOT_LIMITS[accountType as keyof typeof SLOT_LIMITS] || SLOT_LIMITS['F2P']
  const limit = limits[slot as keyof typeof limits] || 0
  const current = slotUsage[slot] || 0
  return current < limit
}

// Calculate how many goals an item matches
export function calculateGoalCoverage(item: ShopItem, goals: Goal[]): string[] {
  const enhancives = JSON.parse(item.enhancives_json)
  const matched: string[] = []
  
  for (const goal of goals) {
    for (const enh of enhancives) {
      if (enh.ability.toLowerCase().includes(goal.stat.toLowerCase()) && enh.boost >= goal.min_boost) {
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

// Generate detailed explanation for a recommendation
function generateExplanation(rec: Recommendation, item: ShopItem, goals: Goal[]): string {
  const baseCost = item.price || 0
  const conversionCost = rec.totalCost - baseCost
  
  const enhancives = JSON.parse(item.enhancives_json)
  const matchedEnhancives = enhancives.filter((e: any) => rec.goalsMatched.includes(e.ability))
  const enhDetails = matchedEnhancives.map((e: any) => `+${e.boost} ${e.ability}`).join(', ')
  
  let explanation = `${enhDetails} | ${baseCost.toLocaleString()}s`
  if (conversionCost > 0) {
    explanation += ` + ${conversionCost.toLocaleString()}s conversion`
  }
  
  return explanation
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
        if (!goal.preferred_slots) {
          matchesPreferredSlot = true
        } else {
          const slots = goal.preferred_slots.split(',').map(s => s.trim())
          if (slots.includes(item.slot)) {
            matchesPreferredSlot = true
          }
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
    
    const rec: Recommendation = {
      type: 'direct',
      item,
      totalCost: item.price,
      goalsMatched,
      explanation: ''
    }
    rec.explanation = generateExplanation(rec, item, goals)
    recommendations.push(rec)
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
    
    // Check if any matched goal allows nuggets
    let allowsNugget = false
    for (const goal of goals) {
      if (goalsMatched.includes(goal.stat)) {
        if (!goal.preferred_slots || goal.preferred_slots.includes('nugget')) {
          allowsNugget = true
          break
        }
      }
    }
    
    if (!allowsNugget) continue
    
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
    
    const rec: Recommendation = {
      type: 'nugget',
      item,
      totalCost,
      goalsMatched,
      explanation: ''
    }
    rec.explanation = generateExplanation(rec, item, goals)
    recommendations.push(rec)
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
        const slots = goal.preferred_slots.split(',').map(s => s.trim())
        if (!slots.includes(item.slot)) {
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
    
    const rec: Recommendation = {
      type: 'swatch',
      item,
      totalCost,
      goalsMatched,
      explanation: ''
    }
    rec.explanation = generateExplanation(rec, item, goals)
    recommendations.push(rec)
  }
  
  // Sort by value/cost ratio and return top 10
  return recommendations
    .sort((a, b) => (b.goalsMatched.length / b.totalCost) - (a.goalsMatched.length / a.totalCost))
    .slice(0, 10)
}




// Find simple 1-for-1 inventory swaps (replace existing items with better alternatives)
export function findSimpleSwaps(
  inventory: InventoryItem[],
  items: ShopItem[],
  goals: Goal[]
): Recommendation[] {
  const recommendations: Recommendation[] = []
  
  for (const invItem of inventory) {
    if (invItem.is_irreplaceable) continue
    
    const invGoalsMatched = calculateGoalCoverage({ enhancives_json: invItem.enhancives_json } as ShopItem, goals)
    
    for (const shopItem of items) {
      if (!shopItem.available || shopItem.slot !== invItem.slot) continue
      
      const shopGoalsMatched = calculateGoalCoverage(shopItem, goals)
      const goalImprovement = shopGoalsMatched.length - invGoalsMatched.length
      const costSavings = 0 - shopItem.price
      const improvementScore = goalImprovement + (costSavings / 1000000)
      
      if (improvementScore <= 0) continue
      
      const rec: Recommendation = {
        type: 'swap',
        item: shopItem,
        totalCost: shopItem.price,
        goalsMatched: shopGoalsMatched,
        explanation: ''
      }
      rec.explanation = `Replace ${invItem.item_name} | ${generateExplanation(rec, shopItem, goals)} | +${goalImprovement} goals`
      recommendations.push(rec)
    }
  }
  
  return recommendations
    .sort((a, b) => {
      const aScore = parseFloat(a.explanation.match(/\+([0-9.]+)/)?.[1] || '0')
      const bScore = parseFloat(b.explanation.match(/\+([0-9.]+)/)?.[1] || '0')
      return bScore - aScore
    })
    .slice(0, 5)
}
