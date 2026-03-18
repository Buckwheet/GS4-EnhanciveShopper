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
  item_type: string | null
  enhancives: Enhancive[]
  is_permanent: boolean
  is_bloodstone: boolean
}

export interface Env {
  DB: D1Database
  ITEMS_BUCKET: R2Bucket
  AI: any
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  DISCORD_BOT_TOKEN: string
  DISCORD_REDIRECT_URI: string
}
