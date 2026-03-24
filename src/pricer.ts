// Item parser and pricing engine

export interface ParsedItem {
  name: string | null
  enhancives: { ability: string; boost: number }[]
  is_permanent: boolean
  item_type: string | null
  worn: string | null
  total_points: number
}

export interface PriceSuggestion {
  parsed: ParsedItem
  comparables: { name: string; shop: string; cost: number; points: number; cost_per_point: number }[]
  suggested_price: number | null
  market_stats: { count: number; min: number; max: number; median: number; p90: number } | null
}

const ABILITY_ALIASES: Record<string, string> = {
  'strength': 'Strength Bonus', 'wisdom': 'Wisdom Bonus', 'aura': 'Aura Bonus',
  'constitution': 'Constitution Bonus', 'dexterity': 'Dexterity Bonus',
  'agility': 'Agility Bonus', 'discipline': 'Discipline Bonus',
  'logic': 'Logic Bonus', 'intuition': 'Intuition Bonus', 'influence': 'Influence Bonus',
  'max mana': 'Max Mana', 'max health': 'Max Health', 'max stamina': 'Max Stamina',
  'mana recovery': 'Mana Recovery', 'health recovery': 'Health Recovery',
  'stamina recovery': 'Stamina Recovery',
}

export function parseItemText(text: string): ParsedItem {
  const lines = text.split('\n').map(l => l.trim())
  const enhancives: { ability: string; boost: number }[] = []
  let is_permanent = false
  let item_type: string | null = null
  let name: string | null = null

  // Try to extract name from "Analysis of X indicates"
  for (const line of lines) {
    const nameMatch = line.match(/Analysis of (.+?) indicates/)
    if (nameMatch) { name = nameMatch[1]; break }
  }

  // Detect item type
  const fullText = text.toLowerCase()
  if (fullText.includes('runestaff') || fullText.includes('rune staff')) item_type = 'runestaff'
  else if (fullText.includes('shield')) item_type = 'shield'
  else if (fullText.includes('armor') || fullText.includes('hauberk') || fullText.includes('brigandine') || fullText.includes('cuirbouilli')) item_type = 'armor'
  else if (fullText.includes('weapon') || fullText.includes('sword') || fullText.includes('crossbow') || fullText.includes('dagger')) item_type = 'weapon'

  // Parse enhancive lines: "It provides a boost of X to Y."
  for (const line of lines) {
    const m = line.match(/provides a boost of (\d+) to (.+?)\./)
    if (m) {
      let ability = m[2].trim()
      // Normalize: if it doesn't end in "Bonus" and isn't a known non-bonus ability, check aliases
      const lower = ability.toLowerCase()
      if (ABILITY_ALIASES[lower]) ability = ABILITY_ALIASES[lower]
      enhancives.push({ ability, boost: parseInt(m[1]) })
    }
  }

  // Check permanence
  if (fullText.includes('persist after') || fullText.includes('will persist')) {
    is_permanent = true
  }

  const total_points = enhancives.reduce((s, e) => s + e.boost, 0)

  // Detect worn slot from name/type keywords
  let worn: string | null = null
  const nameLower = (name || '').toLowerCase()
  const wornMap: [string[], string][] = [
    [['helm', 'greathelm', 'crown', 'headband', 'tiara', 'circlet', 'cap', 'hat', 'hood', 'coif'], 'head'],
    [['necklace', 'medallion', 'torc', 'pendant', 'amulet', 'choker'], 'neck'],
    [['ring', 'band'], 'finger'],
    [['bracelet', 'bracer', 'wristlet', 'cuff', 'manacle'], 'wrist'],
    [['earring', 'earcuff', 'ear-stud'], 'ear'],
    [['pin', 'brooch', 'clasp', 'buckle', 'stickpin'], 'pin'],
    [['cloak', 'mantle', 'cape'], 'shoulders'],
    [['belt', 'sash', 'girdle'], 'belt'],
    [['boots', 'sandals', 'shoes', 'slippers'], 'feet'],
    [['greaves', 'leggings', 'pants', 'trousers', 'breeches'], 'legs'],
    [['gauntlets', 'gloves', 'handwraps'], 'hands'],
    [['arm greaves', 'armband', 'vambrace'], 'arms'],
    [['breastplate', 'armor', 'hauberk', 'brigandine', 'cuirbouilli', 'haubergeon', 'bodysuit'], 'chest'],
  ]
  for (const [keywords, slot] of wornMap) {
    if (keywords.some(k => nameLower.includes(k))) { worn = slot; break }
  }

  return { name, enhancives, is_permanent, item_type, worn, total_points }
}
