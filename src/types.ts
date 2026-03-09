export interface Enhancive {
  boost: number
  ability: string
  level: number
}

export interface EnhanciveItem {
  id: string
  name: string
  town: string
  shop: string
  cost: number | null
  enchant: number | null
  worn: string | null
  enhancives: Enhancive[]
}

export interface Env {
  DB: D1Database
}
