import type { EnhanciveItem } from './types'

// Swap groups: abilities that can be swapped into each other via Sylinara
const SWAP_GROUPS: Record<string, string[]> = {
  'Stat A': ['Strength', 'Wisdom', 'Aura'],
  'Stat B': ['Constitution', 'Dexterity', 'Agility', 'Discipline'],
  'Stat C': ['Logic', 'Intuition', 'Influence'],
  'Weapons': ['Edged Weapons', 'Blunt Weapons', 'Ranged Weapons', 'Thrown Weapons', 'Polearm Weapons', 'Two-Handed Weapons', 'Brawling', 'Spell Aiming'],
  'MC': ['Elemental Mana Control', 'Spirit Mana Control', 'Mental Mana Control'],
  'Lores': ['Elemental Lore - Air', 'Elemental Lore - Earth', 'Elemental Lore - Fire', 'Elemental Lore - Water', 'Spiritual Lore - Blessings', 'Spiritual Lore - Religion', 'Spiritual Lore - Summoning', 'Sorcerous Lore - Demonology', 'Sorcerous Lore - Necromancy', 'Mental Lore - Divination', 'Mental Lore - Manipulation', 'Mental Lore - Telepathy', 'Mental Lore - Transformation'],
  'Recovery': ['Mana Recovery', 'Stamina Recovery', 'Health Recovery'],
  'MIU/AS': ['Magic Item Use', 'Arcane Symbols'],
}

// Reverse lookup: ability name → group name
const ABILITY_TO_GROUP: Record<string, string> = {}
for (const [group, abilities] of Object.entries(SWAP_GROUPS)) {
  for (const ability of abilities) {
    ABILITY_TO_GROUP[ability] = group
  }
}

// Normalize ability name: strip " Bonus", " Ranks", " Base" suffixes
function normalizeAbility(raw: string): string {
  return raw.replace(/ (Bonus|Ranks|Base)$/i, '')
}

// Nugget slots require 25M silver to unlock
const NUGGET_SLOTS = new Set(['nugget', 'shoulders', 'chest', 'hands', 'feet_on', 'waist'])

const SYLINARA_COST = 10_000_000 // 10M silver per swap
const NUGGET_COST = 25_000_000
const PELL_COST = 10_000_000

export interface EnrichedAbility {
  name: string
  group: string | null
  boost: number
}

export interface EnrichedItem {
  id: string
  name: string
  town: string
  shop: string
  cost: number | null
  slot: string | null       // worn slot or "nugget" for weapons/armor
  is_permanent: boolean
  is_nugget: boolean
  true_costs: {
    nugget: number
    wearable_perm: number
    wearable_nonperm: number
  }
  group_totals: Record<string, number>
  abilities: EnrichedAbility[]
  swap_costs: Record<string, Record<string, number>> // group → target ability → cost
  total_boost: number
  num_groups: number
}

function classifySlot(item: EnhanciveItem): { slot: string | null; isNugget: boolean } {
  const worn = item.worn?.toLowerCase() || ''
  // Weapons, runestaffs, shields, armor → nugget slot
  if (!worn || worn === 'weapon' || worn === 'shield' || worn === 'armor') {
    return { slot: 'nugget', isNugget: true }
  }
  // Map worn location to slot name
  const slotMap: Record<string, string> = {
    'finger': 'fingers', 'ear': 'single_ear',
  }
  const slot = slotMap[worn] || worn
  return { slot, isNugget: NUGGET_SLOTS.has(slot) }
}

export function enrichItems(items: EnhanciveItem[]): EnrichedItem[] {
  return items.map(item => {
    const { slot, isNugget } = classifySlot(item)
    const baseCost = item.cost || 0

    const true_costs = {
      nugget: baseCost + NUGGET_COST,
      wearable_perm: baseCost,
      wearable_nonperm: baseCost + PELL_COST,
    }

    const abilities: EnrichedAbility[] = []
    const group_totals: Record<string, number> = {}
    // Track boosts per group per ability for swap cost calc
    const groupAbilities: Record<string, { name: string; boost: number }[]> = {}

    for (const enh of item.enhancives) {
      const name = normalizeAbility(enh.ability)
      const group = ABILITY_TO_GROUP[name] || null
      abilities.push({ name, group, boost: enh.boost })

      if (group) {
        group_totals[group] = (group_totals[group] || 0) + enh.boost
        if (!groupAbilities[group]) groupAbilities[group] = []
        groupAbilities[group].push({ name, boost: enh.boost })
      }
    }

    // Pre-calculate swap costs: for each group, for each possible target ability,
    // how much does it cost to swap all non-matching enhancives to the target?
    const swap_costs: Record<string, Record<string, number>> = {}
    for (const [group, itemAbilities] of Object.entries(groupAbilities)) {
      const targets = SWAP_GROUPS[group]
      if (!targets) continue
      swap_costs[group] = {}
      for (const target of targets) {
        const swapsNeeded = itemAbilities.filter(a => a.name !== target).length
        swap_costs[group][target] = swapsNeeded * SYLINARA_COST
      }
    }

    return {
      id: item.id,
      name: item.name,
      town: item.town,
      shop: item.shop,
      cost: item.cost,
      slot,
      is_permanent: item.is_permanent,
      is_nugget: isNugget,
      true_costs,
      group_totals,
      abilities,
      swap_costs,
      total_boost: abilities.reduce((s, a) => s + a.boost, 0),
      num_groups: Object.keys(group_totals).length,
    }
  })
}
