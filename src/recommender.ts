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

  // Helper: check if a set of picks meets all goals using per-line assignment
  function allGoalsMet(testPicks: Pick[]): boolean {
    const allLines: { name: string; group: string | null; boost: number }[] = []
    for (const pick of testPicks) allLines.push(...pick.item.abilities)
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

  function calcItemCost(item: EnrichedItem, swapCount: number, slots: Record<string, number>): number {
    let tc = item.is_nugget ? item.true_costs.nugget : item.is_permanent ? item.true_costs.wearable_perm : item.true_costs.wearable_nonperm
    if (item.is_nugget) {
      if (![...NUGGET_SLOTS].some(s => (slots[s] || 0) > 0)) tc += SWATCH_COST
    } else {
      if ((slots[item.slot || ''] || 0) <= 0) tc += SWATCH_COST
    }
    return tc + swapCount * 10_000_000
  }

  function consumeSlot(item: EnrichedItem, slots: Record<string, number>) {
    const ns = item.is_nugget ? null : item.slot
    if (ns && (slots[ns] || 0) > 0) { slots[ns]--; return }
    if (item.is_nugget) {
      const ds = [...NUGGET_SLOTS].find(s => (slots[s] || 0) > 0)
      if (ds) { slots[ds]--; return }
    }
    const any = Object.keys(slots).find(s => slots[s] > 0)
    if (any) slots[any]--
  }

  // 4. Run greedy in two modes: balanced (original) and cheapest-first
  function greedyPass(mode: 'balanced' | 'cheapest'): Pick[] {
    const gp: Record<string, number> = {}
    for (const goal of goals) {
      const fromInv = currentBoosts[goal.ability] || 0
      gp[goal.group + ':' + goal.ability] = Math.max(0, goal.target - fromInv)
    }
    const sl = { ...openSlots }
    const used = new Set<string>()
    const result: Pick[] = []
    const slotOpen = () => Object.values(sl).reduce((s, v) => s + v, 0)

    while (slotOpen() > 0) {
      if (Object.values(gp).reduce((s, v) => s + v, 0) <= 0) break

      let bestItem: EnrichedItem | null = null
      let bestValue = -Infinity
      let bestContrib: Record<string, number> = {}
      let bestCost = 0
      let bestSwapCost = 0

      for (const item of candidates) {
        if (used.has(item.id)) continue
        const { contributions, swapCount } = assignLines(item.abilities, gp, goals)
        let score = 0
        for (const [key, filled] of Object.entries(contributions)) {
          score += filled / (totalGapInitial[key] || 1)
        }
        if (score <= 0) continue

        const tc = calcItemCost(item, swapCount, sl)

        let value: number
        if (mode === 'cheapest') {
          // Cheapest item that contributes anything
          value = -tc
        } else {
          let meaningful = 0
          for (const [key, filled] of Object.entries(contributions)) {
            if (filled / (gp[key] || 1) > 0.1) meaningful++
          }
          const combo = 1 + (meaningful - 1) * 0.3
          value = (score * combo) / Math.pow(Math.log10(Math.max(tc, 1000)), alpha)
        }

        if (value > bestValue) {
          bestValue = value
          bestItem = item
          bestContrib = contributions
          bestCost = tc
          bestSwapCost = swapCount * 10_000_000
        }
      }

      if (!bestItem) break
      used.add(bestItem.id)
      consumeSlot(bestItem, sl)
      for (const [key, c] of Object.entries(bestContrib)) {
        gp[key] = Math.max(0, gp[key] - c)
      }
      result.push({ item: bestItem, value_score: bestValue, true_cost: bestCost, swap_cost: bestSwapCost, contributions: bestContrib, swap_details: [] })
    }
    return result
  }

  const balancedPicks = greedyPass('balanced')
  const cheapPicks = greedyPass('cheapest')
  const balancedCost = balancedPicks.reduce((s, p) => s + p.true_cost, 0)
  const cheapCost = cheapPicks.reduce((s, p) => s + p.true_cost, 0)
  const cheapMeetsGoals = allGoalsMet(cheapPicks)

  let picks: Pick[]
  if (cheapMeetsGoals && cheapCost < balancedCost) {
    picks = cheapPicks
    debugLog.push(`Cheapest pass won: ${(cheapCost/1e6).toFixed(1)}M (${cheapPicks.length} items) vs balanced ${(balancedCost/1e6).toFixed(1)}M (${balancedPicks.length} items)`)
  } else {
    picks = balancedPicks
    debugLog.push(`Balanced pass won: ${(balancedCost/1e6).toFixed(1)}M (${balancedPicks.length} items) vs cheapest ${(cheapCost/1e6).toFixed(1)}M (${cheapPicks.length} items, meets=${cheapMeetsGoals})`)
  }
  const usedIds = new Set(picks.map(p => p.item.id))
  const slotsAvail = { ...openSlots }
  for (const p of picks) consumeSlot(p.item, slotsAvail)
  // Rebuild gaps from chosen picks
  for (const goal of goals) {
    const fromInv = currentBoosts[goal.ability] || 0
    gaps[goal.group + ':' + goal.ability] = Math.max(0, goal.target - fromInv)
  }
  const allLines: { name: string; group: string | null; boost: number }[] = []
  for (const p of picks) allLines.push(...p.item.abilities)
  const { contributions: greedyContribs } = assignLines(allLines, { ...gaps }, goals)
  for (const [key, filled] of Object.entries(greedyContribs)) {
    gaps[key] = Math.max(0, gaps[key] - filled)
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

  // 7. Split-downgrade: try replacing expensive picks with multiple cheaper ones
  picks.sort((a, b) => b.true_cost - a.true_cost) // most expensive first
  for (let i = 0; i < picks.length; i++) {
    const expensive = picks[i]
    // Build gap map as if this pick didn't exist
    const splitGapMap: Record<string, number> = {}
    for (const goal of goals) {
      const fromInv = currentBoosts[goal.ability] || 0
      splitGapMap[goal.group + ':' + goal.ability] = Math.max(0, goal.target - fromInv)
    }
    const otherPicks = picks.filter((_, j) => j !== i)
    const otherLines: { name: string; group: string | null; boost: number }[] = []
    for (const p of otherPicks) otherLines.push(...p.item.abilities)
    const { contributions: otherContribs } = assignLines(otherLines, splitGapMap, goals)
    // Remaining gap after other picks
    const splitGaps: Record<string, number> = {}
    let hasGap = false
    for (const key of Object.keys(splitGapMap)) {
      splitGaps[key] = Math.max(0, splitGapMap[key] - (otherContribs[key] || 0))
      if (splitGaps[key] > 0) hasGap = true
    }
    if (!hasGap) continue // prune pass should have caught this

    // Count available slots (excluding other picks)
    const splitSlots: Record<string, number> = { ...openSlots }
    for (const p of otherPicks) {
      const s = p.item.is_nugget ? [...NUGGET_SLOTS].find(sl => (splitSlots[sl] || 0) > 0) || '' : (p.item.slot || '')
      if (s && splitSlots[s]) splitSlots[s]--
    }

    // Mini-greedy to fill splitGaps with cheap items
    const splitUsed = new Set(otherPicks.map(p => p.item.id))
    const replacements: Pick[] = []
    const miniSlots = { ...splitSlots }
    const miniGaps = { ...splitGaps }
    const miniTotalOpen = () => Object.values(miniSlots).reduce((s, v) => s + v, 0)

    while (miniTotalOpen() > 0) {
      const totalGap = Object.values(miniGaps).reduce((s, v) => s + v, 0)
      if (totalGap <= 0) break

      let best: EnrichedItem | null = null
      let bestCost = Infinity
      let bestContrib: Record<string, number> = {}
      let bestSwaps = 0

      for (const item of candidates) {
        if (splitUsed.has(item.id)) continue
        const { contributions: c, swapCount } = assignLines(item.abilities, miniGaps, goals)
        const score = Object.values(c).reduce((s, v) => s + v, 0)
        if (score <= 0) continue

        let tc = item.is_nugget ? item.true_costs.nugget : item.is_permanent ? item.true_costs.wearable_perm : item.true_costs.wearable_nonperm
        if (item.is_nugget) {
          if (![...NUGGET_SLOTS].some(s => (miniSlots[s] || 0) > 0)) tc += SWATCH_COST
        } else {
          if ((miniSlots[item.slot || ''] || 0) <= 0) tc += SWATCH_COST
        }
        tc += swapCount * 10_000_000

        // Prefer cheapest item that contributes
        if (tc < bestCost) {
          bestCost = tc
          best = item
          bestContrib = c
          bestSwaps = swapCount
        }
      }

      if (!best) break
      splitUsed.add(best.id)
      // Consume slot
      const ns = best.is_nugget ? [...NUGGET_SLOTS].find(s => (miniSlots[s] || 0) > 0) || '' : (best.slot || '')
      if (ns && (miniSlots[ns] || 0) > 0) miniSlots[ns]--
      else {
        const any = Object.keys(miniSlots).find(s => miniSlots[s] > 0)
        if (any) miniSlots[any]--
      }
      for (const [key, filled] of Object.entries(bestContrib)) {
        miniGaps[key] = Math.max(0, miniGaps[key] - filled)
      }
      replacements.push({ item: best, value_score: 0, true_cost: bestCost, swap_cost: bestSwaps * 10_000_000, contributions: bestContrib, swap_details: [] })
    }

    // Check: do replacements fill the gap AND cost less?
    const replacementCost = replacements.reduce((s, p) => s + p.true_cost, 0)
    const replacementGap = Object.values(miniGaps).reduce((s, v) => s + v, 0)
    if (replacementGap <= 0 && replacementCost < expensive.true_cost) {
      debugLog.push(`Split: ${expensive.item.name} (${expensive.true_cost}) → ${replacements.length} items (${replacementCost}): ${replacements.map(r => r.item.name + '=' + r.true_cost).join(', ')}`)
      picks.splice(i, 1, ...replacements)
      // Update pickedIds
      pickedIds.delete(expensive.item.id)
      for (const r of replacements) pickedIds.add(r.item.id)
      i-- // re-check from this position
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
      const hasSlot = [...NUGGET_SLOTS].some(s => (openSlots[s] || 0) - (finalSlots[s] || 0) > 0)
      if (!hasSlot) base += SWATCH_COST
    } else {
      const ns = item.slot || ''
      if ((openSlots[ns] || 0) - (finalSlots[ns] || 0) <= 0) base += SWATCH_COST
    }
    pick.true_cost = base + pick.swap_cost
    // Track slot usage
    const s = item.is_nugget ? [...NUGGET_SLOTS].find(sl => (openSlots[sl] || 0) - (finalSlots[sl] || 0) > 0) || '' : (item.slot || '')
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
