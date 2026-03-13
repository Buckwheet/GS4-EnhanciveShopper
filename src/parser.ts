// Parse item text to extract enhancives
export function parseItemText(text: string) {
  const enhancives = []
  const lines = text.split('\n')
  
  let isPermanent = true
  let detectedSlot = null
  
  for (const line of lines) {
    // Check for crumble/persist
    if (line.includes('crumble into dust')) {
      isPermanent = false
    }
    
    // Parse enhancive boosts
    const boostMatch = line.match(/It provides a boost of (\d+) to (.+)\./)
    if (boostMatch) {
      const boost = parseInt(boostMatch[1], 10)
      const ability = boostMatch[2].trim()
      
      // Check for level requirement
      let level = 0
      const nextLineIndex = lines.indexOf(line) + 1
      if (nextLineIndex < lines.length) {
        const levelMatch = lines[nextLineIndex].match(/not trained (\d+) times/)
        if (levelMatch) {
          level = parseInt(levelMatch[1], 10)
        }
      }
      
      enhancives.push({ boost, ability, level })
    }
    
    // Detect slot from "You could wear/put/attach..." or "can be worn"
    const slotMatch = line.match(/You could (wear|put|attach|slip|hang|drape|sling).+?(around your neck|on your head|on your fingers?|on your wrists?|around your waist|on your back|over your shoulders?|on your feet|on your hands|on your arms|on your legs|on your ankle|in your hair|from.+?ears?|over your chest|over your front|on your belt|as a pin)/i)
    if (slotMatch) {
      const location = slotMatch[2].toLowerCase()
      detectedSlot = mapSlotLocation(location)
    }
    
    // Also check for "can be worn on the X"
    const canBeWornMatch = line.match(/can be worn (on|in|around|from|over|as) (?:the |your )?(head|neck|hair|ears?|shoulders?|back|chest|front|arms?|wrists?|hands?|fingers?|waist|belt|legs|ankle|feet)/i)
    if (canBeWornMatch) {
      const location = `on your ${canBeWornMatch[2].toLowerCase()}`
      detectedSlot = mapSlotLocation(location)
    }
  }
  
  return { enhancives, isPermanent, detectedSlot }
}

function mapSlotLocation(location: string): string {
  const mapping: Record<string, string> = {
    'around your neck': 'neck',
    'on your head': 'head',
    'in your hair': 'hair',
    'from a single ear': 'single_ear',
    'from both ears': 'both_ears',
    'over your shoulder': 'shoulder_slung',
    'over your shoulders': 'shoulders_draped',
    'on your back': 'back',
    'over your chest': 'chest',
    'over your front': 'front',
    'on your arms': 'arms',
    'on your wrist': 'wrist',
    'on your hands': 'hands',
    'on your finger': 'fingers',
    'on your fingers': 'fingers',
    'around your waist': 'waist',
    'on your belt': 'belt',
    'on your legs': 'legs_attached',
    'on your ankle': 'ankle',
    'on your feet': 'feet_on',
    'as a pin': 'pin'
  }
  
  for (const [key, value] of Object.entries(mapping)) {
    if (location.includes(key)) return value
  }
  
  return 'unknown'
}

// Parse stats from >stats output
export function parseStats(text: string) {
  const stats: Record<string, number> = {}
  const lines = text.split('\n')
  
  const statNames = ['STR', 'CON', 'DEX', 'AGI', 'DIS', 'AUR', 'LOG', 'INT', 'WIS', 'INF']
  
  for (const line of lines) {
    for (const stat of statNames) {
      if (line.includes(`(${stat})`)) {
        const match = line.match(/\((\d+)\)/)
        if (match) {
          stats[stat] = parseInt(match[1], 10)
        }
      }
    }
  }
  
  return stats
}

// Parse skills from >skill base output
export function parseSkills(text: string) {
  const skills: Record<string, number> = {}
  const lines = text.split('\n')
  
  for (const line of lines) {
    // Match skill lines with ranks
    const match = line.match(/^ {2}(.+?)\.*\|\s+\d+\s+(\d+)/)
    if (match) {
      const skillName = match[1].trim()
      const ranks = parseInt(match[2], 10)
      skills[skillName] = ranks
    }
  }
  
  return skills
}

// Calculate actual bonus from ranks based on current rank
export function ranksToBonus(ranksAdded: number, currentRank: number): number {
  let bonus = 0
  for (let i = 0; i < ranksAdded; i++) {
    const rank = currentRank + i + 1
    if (rank <= 10) bonus += 5
    else if (rank <= 20) bonus += 4
    else if (rank <= 30) bonus += 3
    else if (rank <= 40) bonus += 2
    else bonus += 1
  }
  return bonus
}

// Normalize enhancive value for comparison
export function normalizeEnhancive(ability: string, boost: number, currentRank?: number): number {
  // Check if it's a stat
  if (ability.includes('Base')) {
    return boost
  } else if (ability.includes('Bonus') && !ability.includes('Ranks')) {
    // Stat bonus is double
    return boost * 2
  } else if (ability.includes('Ranks')) {
    // Skill ranks - need current rank to calculate
    if (currentRank !== undefined) {
      return ranksToBonus(boost, currentRank)
    }
    return boost // fallback
  } else {
    // Skill bonus
    return boost
  }
}
