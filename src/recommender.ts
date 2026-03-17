import { ABILITY_TO_GROUP, normalizeAbility } from './enrichment'
import type { EnrichedItem } from './enrichment'
import { STAT_CAP, SKILL_CAP } from './constants'

// Stats use STAT_CAP (40), everything else uses SKILL_CAP (50)
const STATS = new Set([
  'Strength', 'Constitution', 'Dexterity', 'Agility', 'Discipline',
  'Aura', 'Logic', 'Intuition', 'Wisdom', 'Influence',
])

export interface Goal {
  ability: string   // exact ability name, e.g. "Spirit Mana Control"
  group: string     // resolved from ABILITY_TO_GROUP
  target: number    // default = cap
}

export interface RecommendationResult {
  picks: Pick[]
  total_cost: number
  gaps_remaining: Record<string, number>
  fill_pct: number
  slots_used: number
  alpha: number
}

export interface Pick {
  item: EnrichedItem
  value_score: number
  true_cost: number
  swap_cost: number
  contributions: Record<string, number> // group → how much this pick fills
}

// Excluded shops
const EXCLUDED_SHOPS = new Set(['Yakushi'])

export function runRecommendation(
  goals: Goal[],
  inventory: { enhancives_json: string; slot: string; is_locked: number }[],
  enrichedItems: EnrichedItem[],
  availableSlots: number,
  alpha: number = 1.5,
): RecommendationResult {
  // 1. Calculate current boosts from inventory
  const currentBoosts: Record<string, number> = {}
  for (const inv of inventory) {
    const enhs = JSON.parse(inv.enhancives_json || '[]') as { ability: string; boost: number }[]
    for (const e of enhs) {
      const name = normalizeAbility(e.ability.replace(/ \([A-Z]{3}\)$/, ''))
      currentBoosts[name] = (currentBoosts[name] || 0) + e.boost
    }
  }

  // 2. Calculate gaps per goal
  const gaps: Record<string, number> = {}
  const totalGapInitial: Record<string, number> = {}
  for (const goal of goals) {
    const current = currentBoosts[goal.ability] || 0
    const gap = Math.max(0, goal.target - current)
    gaps[goal.group + ':' + goal.ability] = gap
    totalGapInitial[goal.group + ':' + goal.ability] = gap
  }

  // 3. Filter items: available, not excluded, has relevant groups
  const goalGroups = new Set(goals.map(g => g.group))
  const candidates = enrichedItems.filter(item =>
    item.cost !== null &&
    !EXCLUDED_SHOPS.has(item.shop) &&
    Object.keys(item.group_totals).some(g => goalGroups.has(g))
  )

  // 4. Greedy loop
  const picks: Pick[] = []
  const usedIds = new Set<string>()
  let slotsLeft = availableSlots

  while (slotsLeft > 0) {
    // Check if all gaps are filled
    const totalGap = Object.values(gaps).reduce((s, v) => s + v, 0)
    if (totalGap <= 0) break

    let bestItem: EnrichedItem | null = null
    let bestValue = -1
    let bestContributions: Record<string, number> = {}
    let bestTrueCost = 0
    let bestSwapCost = 0

    for (const item of candidates) {
      if (usedIds.has(item.id)) continue

      // Calculate contributions to each goal
      const contributions: Record<string, number> = {}
      let weightedScore = 0

      for (const goal of goals) {
        const key = goal.group + ':' + goal.ability
        const gap = gaps[key]
        if (gap <= 0) continue

        const groupTotal = item.group_totals[goal.group]
        if (!groupTotal) continue

        const contribution = Math.min(groupTotal, gap)
        contributions[key] = contribution
        weightedScore += contribution / gap
      }

      if (weightedScore <= 0) continue

      // Calculate true cost for this item
      let trueCost = item.cost || 0
      if (item.is_nugget) {
        trueCost = item.true_costs.nugget
      } else if (item.is_permanent) {
        trueCost = item.true_costs.wearable_perm
      } else {
        trueCost = item.true_costs.wearable_nonperm
      }

      // Add swap costs: for each goal group this item contributes to,
      // add the swap cost for the target ability
      let swapCost = 0
      for (const goal of goals) {
        const key = goal.group + ':' + goal.ability
        if (!contributions[key]) continue
        const groupSwapCosts = item.swap_costs[goal.group]
        if (groupSwapCosts) {
          swapCost += groupSwapCosts[goal.ability] || 0
        }
      }
      trueCost += swapCost

      const value = weightedScore / Math.pow(Math.log10(Math.max(trueCost, 1000)), alpha)

      if (value > bestValue) {
        bestValue = value
        bestItem = item
        bestContributions = contributions
        bestTrueCost = trueCost
        bestSwapCost = swapCost
      }
    }

    if (!bestItem) break

    // Pick this item
    usedIds.add(bestItem.id)
    slotsLeft--

    // Update gaps
    for (const [key, contribution] of Object.entries(bestContributions)) {
      gaps[key] = Math.max(0, gaps[key] - contribution)
    }

    picks.push({
      item: bestItem,
      value_score: bestValue,
      true_cost: bestTrueCost,
      swap_cost: bestSwapCost,
      contributions: bestContributions,
    })
  }

  // Calculate summary
  const totalCost = picks.reduce((s, p) => s + p.true_cost, 0)
  const totalInitialGap = Object.values(totalGapInitial).reduce((s, v) => s + v, 0)
  const totalRemaining = Object.values(gaps).reduce((s, v) => s + v, 0)
  const fillPct = totalInitialGap > 0 ? ((totalInitialGap - totalRemaining) / totalInitialGap) * 100 : 100

  return {
    picks,
    total_cost: totalCost,
    gaps_remaining: gaps,
    fill_pct: fillPct,
    slots_used: picks.length,
    alpha,
  }
}

// Helper: resolve goals from ability names, defaulting target to cap
export function resolveGoals(abilities: string[]): Goal[] {
  return abilities.map(ability => ({
    ability,
    group: ABILITY_TO_GROUP[ability] || 'unknown',
    target: STATS.has(ability) ? STAT_CAP : SKILL_CAP,
  }))
}
