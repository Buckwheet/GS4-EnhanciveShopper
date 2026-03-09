import type { EnhanciveItem } from './types'

const TOWNS = [
  'icemule_trace',
  'mist_harbor',
  'rivers_rest',
  'solhaven',
  'ta_illistim',
  'ta_vaalor',
  'teras_isle',
  'wehnimers_landing',
  'zul_logoth',
]

const BASE_URL = 'https://shops.elanthia.online/data/'

export async function scrapeEnhancives(): Promise<EnhanciveItem[]> {
  const items: EnhanciveItem[] = []

  for (const town of TOWNS) {
    try {
      const response = await fetch(`${BASE_URL}${town}.json`)
      const data = await response.json()

      for (const shop of data.shops || []) {
        for (const room of shop.inv || []) {
          for (const item of room.items || []) {
            const details = item.details || {}
            if (details.enhancives && Array.isArray(details.enhancives)) {
              items.push({
                id: item.id,
                name: item.name,
                town: data.town,
                shop: shop.shop_owner || 'Unknown',
                cost: details.cost || null,
                enchant: details.enchant || null,
                worn: details.worn || null,
                enhancives: details.enhancives,
              })
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to scrape ${town}:`, error)
    }
  }

  return items
}

export async function getLastUpdated(): Promise<string | null> {
  try {
    const response = await fetch('https://shops.elanthia.online/')
    const html = await response.text()
    const match = html.match(/Last updated:\s*([^<]+)/)
    return match ? match[1].trim() : null
  } catch (error) {
    console.error('Failed to get last updated:', error)
    return null
  }
}
