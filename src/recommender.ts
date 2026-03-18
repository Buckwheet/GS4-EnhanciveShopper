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
  debugLog: string[]
}

export interface Pick {
  item: EnrichedItem
  value_score: number
  true_cost: number
  swap_cost: number
  contributions: Record<string, number>
  swap_details: { from: string; to: string; boost: number }[]
}

// Excluded shops
const EXCLUDED_SHOPS = new Set(['Yakushi'])

const SWATCH_COST = 25_000_000

// Nugget transmute can produce these slots
const NUGGET_SLOTS = new Set(['ankle', 'waist', 'arms', 'hair', 'head', 'pin', 'single_ear', 'both_ears', 'wrist', 'fingers', 'neck'])

/**
 * Assign each enhancive line on an item to the best goal ability.
 * Each line is atomic — its full boost goes to one target.
 * Returns contributions (group:ability → boost filled) and swap count.
 */
function assignLines(
  abilities: { name: string; group: string | null; boost: number }[],
  gapMap: Record<string, number>,  // "group:ability" → remaining gap
  goalList: Goal[],
): { contributions: Record<string, number>; swapCount: number; swapDetails: { from: string; to: string; boost: number }[] } {
  const contributions: Record<string, number> = {}
  let swapCount = 0
  const swapDetails: { from: string; to: string; boost: number }[] = []

  // Build lookup: group → list of goal keys with remaining gap
  const goalsByGroup: Record<string, { key: string; ability: string; gap: number }[]> = {}
  for (const g of goalList) {
    const key = g.group + ':' + g.ability
    const gap = gapMap[key]
    if (!gap || gap <= 0) continue
    if (!goalsByGroup[g.group]) goalsByGroup[g.group] = []
    goalsByGroup[g.group].push({ key, ability: g.ability, gap })
  }

  // For each group, assign lines to goals greedily (best fit: line whose boost is closest to gap without going under)
  for (const [group, groupGoals] of Object.entries(goalsByGroup)) {
    const lines = abilities.filter(a => a.group === group)
    if (!lines.length) continue

    // Track remaining gap per goal for this assignment
    const remaining: Record<string, number> = {}
    for (const g of groupGoals) remaining[g.key] = g.gap

    // Sort lines largest first — assign big lines to big gaps
    const sortedLines = [...lines].sort((a, b) => b.boost - a.boost)

    for (const line of sortedLines) {
      // Find the goal with the largest remaining gap
      let bestGoal: string | null = null
      let bestAbility: string | null = null
      let bestGap = 0
      for (const g of groupGoals) {
        if (remaining[g.key] > 0 && remaining[g.key] > bestGap) {
          bestGap = remaining[g.key]
          bestGoal = g.key
          bestAbility = g.ability
        }
      }
      if (!bestGoal || !bestAbility) continue // no gaps left in this group

      const filled = Math.min(line.boost, remaining[bestGoal])
      contributions[bestGoal] = (contributions[bestGoal] || 0) + filled
      remaining[bestGoal] -= filled
      if (line.name !== bestAbility) {
        swapCount++
        swapDetails.push({ from: line.name, to: bestAbility, boost: line.boost })
      }
    }
  }

  return { contributions, swapCount, swapDetails }
}

export function runRecommendation(
  goals: Goal[],
  inventory: { enhancives_json: string; slot: string; is_locked: number }[],
  enrichedItems: EnrichedItem[],
  openSlots: Record<string, number>,
  alpha: number = 1.5,
  hasBloodstone: boolean = false,
): RecommendationResult {
  // 1. Calculate current boosts from inventory
  const currentBoosts: Record<string, number> = {}
  for (const inv of inventory) {
    const enhs = JSON.parse(inv.enhancives_json || '[]') as { ability: string; boost: number }[]
    for (const e of enhs) {
      const stripped = e.ability.replace(/ \([A-Z]{3}\)$/, '')
      const isStatBonus = /Bonus$/i.test(stripped) && STATS.has(stripped.replace(/ Bonus$/i, ''))
      const name = normalizeAbility(stripped)
      const effective = isStatBonus ? e.boost * 2 : e.boost
      currentBoosts[name] = (currentBoosts[name] || 0) + effective
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
  const debugLog: string[] = []
  const candidates = enrichedItems.filter(item =>
    item.cost !== null &&
    !EXCLUDED_SHOPS.has(item.shop) &&
    (!hasBloodstone || !item.is_bloodstone) &&
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

      // Calculate contributions to each goal using per-line assignment
      const { contributions, swapCount } = assignLines(item.abilities, gaps, goals)

      let weightedScore = 0
      for (const [key, filled] of Object.entries(contributions)) {
        const initGap = totalGapInitial[key] || 1
        weightedScore += filled / initGap
      }

      if (weightedScore <= 0) continue

      // Combo bonus: items hitting multiple unfilled goals save future slots/items
      // Only count goals where the item fills >10% of the remaining gap
      let meaningfulGoals = 0
      for (const [key, filled] of Object.entries(contributions)) {
        if (filled / (gaps[key] || 1) > 0.1) meaningfulGoals++
      }
      const comboMultiplier = 1 + (meaningfulGoals - 1) * 0.3

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

      // Swap cost: assignLines already counted exact swaps needed
      const swapCost = swapCount * 10_000_000
      trueCost += swapCost

      const value = (weightedScore * comboMultiplier) / Math.pow(Math.log10(Math.max(trueCost, 1000)), alpha)

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
      swap_details: [],
    })
  }

  // Helper: check if a set of picks meets all goals using per-line assignment
  function allGoalsMet(testPicks: Pick[]): boolean {
    // Collect all enhancive lines from all picks
    const allLines: { name: string; group: string | null; boost: number }[] = []
    for (const pick of testPicks) {
      allLines.push(...pick.item.abilities)
    }
    // Build gap map from inventory
    const gapMap: Record<string, number> = {}
    for (const g of goals) {
      const fromInv = currentBoosts[g.ability] || 0
      gapMap[g.group + ':' + g.ability] = Math.max(0, g.target - fromInv)
    }
    const { contributions } = assignLines(allLines, gapMap, goals)
    return goals.every(g => {
      const key = g.group + ':' + g.ability
      const fromInv = currentBoosts[g.ability] || 0
      return fromInv + (contributions[key] || 0) >= g.target
    })
  }

  // 5. Prune: remove redundant picks (worst value first)
  picks.sort((a, b) => a.value_score - b.value_score)
  let pruned = true
  while (pruned) {
    pruned = false
    for (let i = 0; i < picks.length; i++) {
      if (allGoalsMet(picks.filter((_, j) => j !== i))) {
        picks.splice(i, 1)
        pruned = true
        break
      }
    }
  }

  // 6. Downgrade: replace expensive picks with cheaper alternatives
  const pickedIds = new Set(picks.map(p => p.item.id))
  // Track slot usage from current picks
  const pickSlots: Record<string, number> = {}
  for (const p of picks) {
    const s = p.item.is_nugget ? null : p.item.slot
    if (s && slotsAvail[s] !== undefined) pickSlots[s] = (pickSlots[s] || 0) + 1
  }

  function calcTrueCost(item: EnrichedItem, excludeSlot?: string | null): number {
    let tc = item.is_nugget ? item.true_costs.nugget : item.is_permanent ? item.true_costs.wearable_perm : item.true_costs.wearable_nonperm
    if (item.is_nugget) {
      const hasSlot = [...NUGGET_SLOTS].some(s => (slotsAvail[s] || 0) - (pickSlots[s] || 0) > 0)
      if (!hasSlot) tc += SWATCH_COST
    } else {
      const nativeSlot = item.slot || ''
      const avail = (slotsAvail[nativeSlot] || 0) - (pickSlots[nativeSlot] || 0)
      const freed = excludeSlot === nativeSlot ? 1 : 0
      if (avail + freed <= 0) tc += SWATCH_COST
    }
    // Swap cost via per-line assignment against current gaps
    const { swapCount } = assignLines(item.abilities, gaps, goals)
    tc += swapCount * 10_000_000
    return tc
  }

  picks.sort((a, b) => a.value_score - b.value_score) // worst value first
  for (let i = 0; i < picks.length; i++) {
    const current = picks[i]
    const currentGroups = new Set(Object.keys(current.item.group_totals))
    const currentSlot = current.item.is_nugget ? null : current.item.slot
    const alternatives = candidates.filter(c =>
      !pickedIds.has(c.id) &&
      c.id !== current.item.id &&
      Object.keys(c.group_totals).some(g => currentGroups.has(g))
    )
    // Calculate actual cost for each alternative and filter/sort by it
    const costed = alternatives.map(alt => ({ alt, cost: calcTrueCost(alt, currentSlot) }))
      .filter(x => x.cost < current.true_cost)
    costed.sort((a, b) => a.cost - b.cost)
    // Debug: find the pendant specifically
    const pendant = alternatives.find(a => a.name.includes('star sapphire pendant'))
    if (pendant) {
      debugLog.push(`  pendant found in alternatives: cost=${calcTrueCost(pendant, currentSlot)} is_nugget=${pendant.is_nugget} slot=${pendant.slot} perm=${pendant.is_permanent} true_costs=${JSON.stringify(pendant.true_costs)} swap_costs=${JSON.stringify(pendant.swap_costs)}`)
    }
    debugLog.push(`Downgrade ${current.item.name} (${current.true_cost}): ${costed.length} candidates, top5: ${costed.slice(0,5).map(x => x.alt.name + '=' + x.cost + ' slot=' + x.alt.slot).join(' | ')}`)

    for (const { alt, cost } of costed) {
      const testPick: Pick = { item: alt, value_score: 0, true_cost: cost, swap_cost: 0, contributions: {}, swap_details: [] }
      const testPicks = picks.map((p, j) => j === i ? testPick : p)
      if (allGoalsMet(testPicks)) {
        console.log(`Downgrade: ${current.item.name} (${current.true_cost}) → ${alt.name} (${cost}) slot=${alt.slot}`)
        pickedIds.delete(current.item.id)
        pickedIds.add(alt.id)
        // Update slot tracking
        if (currentSlot) pickSlots[currentSlot] = (pickSlots[currentSlot] || 0) - 1
        const newSlot = alt.is_nugget ? null : alt.slot
        if (newSlot) pickSlots[newSlot] = (pickSlots[newSlot] || 0) + 1
        picks[i] = { item: alt, value_score: 0, true_cost: cost, swap_cost: 0, contributions: current.contributions, swap_details: [] }
        break
      }
    }
  }
  picks.sort((a, b) => b.value_score - a.value_score)

  // Recalculate per-pick contributions and gaps using per-line assignment
  const finalGapMap: Record<string, number> = {}
  for (const goal of goals) {
    const fromInv = currentBoosts[goal.ability] || 0
    finalGapMap[goal.group + ':' + goal.ability] = Math.max(0, goal.target - fromInv)
  }
  // Assign all lines globally for gap calc
  const allFinalLines: { name: string; group: string | null; boost: number }[] = []
  for (const pick of picks) allFinalLines.push(...pick.item.abilities)
  const { contributions: finalContribs } = assignLines(allFinalLines, finalGapMap, goals)
  for (const goal of goals) {
    const key = goal.group + ':' + goal.ability
    gaps[key] = Math.max(0, finalGapMap[key] - (finalContribs[key] || 0))
  }
  // Recalculate per-pick contributions, swap costs, and true costs
  const remainingGaps = { ...finalGapMap }
  const finalSlots: Record<string, number> = {}
  for (const pick of picks) {
    const { contributions, swapCount, swapDetails } = assignLines(pick.item.abilities, remainingGaps, goals)
    pick.contributions = contributions
    pick.swap_cost = swapCount * 10_000_000
    pick.swap_details = swapDetails
    // Recompute true_cost from components
    const item = pick.item
    let base = item.is_nugget ? item.true_costs.nugget : item.is_permanent ? item.true_costs.wearable_perm : item.true_costs.wearable_nonperm
    if (item.is_nugget) {
      const hasSlot = [...NUGGET_SLOTS].some(s => (slotsAvail[s] || 0) - (finalSlots[s] || 0) > 0)
      if (!hasSlot) base += SWATCH_COST
    } else {
      const ns = item.slot || ''
      if ((slotsAvail[ns] || 0) - (finalSlots[ns] || 0) <= 0) base += SWATCH_COST
    }
    pick.true_cost = base + pick.swap_cost
    // Track slot usage
    const s = item.is_nugget ? [...NUGGET_SLOTS].find(sl => (slotsAvail[sl] || 0) - (finalSlots[sl] || 0) > 0) || '' : (item.slot || '')
    if (s) finalSlots[s] = (finalSlots[s] || 0) + 1
    for (const [key, filled] of Object.entries(contributions)) {
      remainingGaps[key] = Math.max(0, remainingGaps[key] - filled)
    }
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
    debugLog,
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
