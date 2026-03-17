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

const SWATCH_COST = 25_000_000

// Nugget transmute can produce these slots
const NUGGET_SLOTS = new Set(['pin', 'head', 'hair', 'single_ear', 'both_ears', 'neck', 'arms', 'wrist', 'fingers', 'waist', 'ankle'])

export function runRecommendation(
  goals: Goal[],
  inventory: { enhancives_json: string; slot: string; is_locked: number }[],
  enrichedItems: EnrichedItem[],
  openSlots: Record<string, number>,
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
  const slotsAvail = { ...openSlots }
  const totalOpen = () => Object.values(slotsAvail).reduce((s, v) => s + v, 0)

  while (totalOpen() > 0) {
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
      // Key constraint: when multiple goals share a group (e.g. Religion + Blessings
      // both in Lores), the group's total points must be SPLIT, not double-counted.
      // Each enhancive can only be swapped to one target ability.
      const contributions: Record<string, number> = {}
      let weightedScore = 0

      // Group goals by their group to handle shared-group allocation
      const goalsByGroup: Record<string, { key: string; gap: number }[]> = {}
      for (const goal of goals) {
        const key = goal.group + ':' + goal.ability
        const gap = gaps[key]
        if (gap <= 0) continue
        const groupTotal = item.group_totals[goal.group]
        if (!groupTotal) continue
        if (!goalsByGroup[goal.group]) goalsByGroup[goal.group] = []
        goalsByGroup[goal.group].push({ key, gap })
      }

      for (const [group, groupGoals] of Object.entries(goalsByGroup)) {
        const pool = item.group_totals[group]
        if (groupGoals.length === 1) {
          // Single goal for this group — straightforward
          const g = groupGoals[0]
          const contribution = Math.min(pool, g.gap)
          contributions[g.key] = contribution
          weightedScore += contribution / g.gap
        } else {
          // Multiple goals share this group — allocate proportionally by gap
          const totalGapInGroup = groupGoals.reduce((s, g) => s + g.gap, 0)
          let remaining = pool
          for (const g of groupGoals) {
            const share = Math.min(Math.floor(pool * g.gap / totalGapInGroup), g.gap, remaining)
            if (share > 0) {
              contributions[g.key] = share
              weightedScore += share / g.gap
              remaining -= share
            }
          }
          // Distribute any leftover from rounding to first goal with room
          for (const g of groupGoals) {
            if (remaining <= 0) break
            const current = contributions[g.key] || 0
            const extra = Math.min(remaining, g.gap - current)
            if (extra > 0) {
              contributions[g.key] = current + extra
              weightedScore += extra / g.gap
              remaining -= extra
            }
          }
        }
      }

      if (weightedScore <= 0) continue

      // Calculate true cost for this item
      let trueCost = item.cost || 0
      let slotCost = 0
      if (item.is_nugget) {
        trueCost = item.true_costs.nugget
        // Nugget transmute: check if any transmute-target slot is open (no swatch needed)
        const hasDirectSlot = [...NUGGET_SLOTS].some(s => (slotsAvail[s] || 0) > 0)
        if (!hasDirectSlot) slotCost = SWATCH_COST // need swatch after transmute
      } else if (item.is_permanent) {
        trueCost = item.true_costs.wearable_perm
        const nativeSlot = item.slot || ''
        if ((slotsAvail[nativeSlot] || 0) <= 0) slotCost = SWATCH_COST
      } else {
        trueCost = item.true_costs.wearable_nonperm
        const nativeSlot = item.slot || ''
        if ((slotsAvail[nativeSlot] || 0) <= 0) slotCost = SWATCH_COST
      }
      trueCost += slotCost

      // Add swap costs: for each GROUP this item contributes to, add swap cost once.
      // When multiple goals share a group (e.g. Religion + Blessings), the swap cost
      // is for the most expensive target (worst case — some enhancives go to each).
      let swapCost = 0
      const groupsSeen = new Set<string>()
      for (const goal of goals) {
        const key = goal.group + ':' + goal.ability
        if (!contributions[key]) continue
        if (groupsSeen.has(goal.group)) continue
        groupsSeen.add(goal.group)
        const groupSwapCosts = item.swap_costs[goal.group]
        if (groupSwapCosts) {
          // Use the cheapest target's swap cost as baseline (best case allocation)
          const relevantGoals = goals.filter(g => g.group === goal.group && contributions[g.group + ':' + g.ability])
          if (relevantGoals.length === 1) {
            swapCost += groupSwapCosts[relevantGoals[0].ability] || 0
          } else {
            // Multiple targets in same group: each enhancive swaps to one target.
            // Count of enhancives that don't match ANY target = swaps needed.
            const targetSet = new Set(relevantGoals.map(g => g.ability))
            const itemAbilities = item.abilities.filter(a => a.group === goal.group)
            const swapsNeeded = itemAbilities.filter(a => !targetSet.has(a.name)).length
            swapCost += swapsNeeded * 10_000_000
          }
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

    // Pick this item — consume a slot
    usedIds.add(bestItem.id)

    // Find best slot to consume: native slot if open, else any open slot
    const nativeSlot = bestItem.is_nugget ? null : bestItem.slot
    if (nativeSlot && (slotsAvail[nativeSlot] || 0) > 0) {
      slotsAvail[nativeSlot]--
    } else if (bestItem.is_nugget) {
      // Try a nugget-transmute slot first
      const directSlot = [...NUGGET_SLOTS].find(s => (slotsAvail[s] || 0) > 0)
      if (directSlot) {
        slotsAvail[directSlot]--
      } else {
        // Any open slot (swatch needed, already costed)
        const anySlot = Object.keys(slotsAvail).find(s => slotsAvail[s] > 0)
        if (anySlot) slotsAvail[anySlot]--
      }
    } else {
      // Wearable needing swatch — any open slot
      const anySlot = Object.keys(slotsAvail).find(s => slotsAvail[s] > 0)
      if (anySlot) slotsAvail[anySlot]--
    }

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

// Map fuzzy DB goal stat (e.g. "lore", "mana control") to exact ability names
// Returns all matching abilities from ABILITY_TO_GROUP keys
export function resolveGoalStat(stat: string): string[] {
  const lower = stat.toLowerCase()
  return Object.keys(ABILITY_TO_GROUP).filter(ability =>
    ability.toLowerCase().includes(lower)
  )
}
