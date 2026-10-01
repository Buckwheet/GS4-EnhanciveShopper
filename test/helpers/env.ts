import { vi } from 'vitest'
import type { Env } from '../../src/types'

interface Query {
  sql: string
  args: unknown[]
}

interface MockEnvOptions extends Partial<Env> {
  SESSION_SECRET?: string
  rows?: (sql: string, args: unknown[]) => unknown[]
  items?: Map<string, string>
}

export type MockEnv = Env & {
  SESSION_SECRET: string
  __queries: Query[]
  __items: Map<string, string>
}

export function mockEnv(opts: MockEnvOptions = {}): MockEnv {
  const { rows, items: seedItems, ...overrides } = opts
  const queries: Query[] = []
  const items = new Map(seedItems)
  const db = {
    prepare(sql: string) {
      let args: unknown[] = []
      const execute = () => {
        queries.push({ sql, args: [...args] })
        return rows?.(sql, args) ?? []
      }
      return {
        bind(...values: unknown[]) {
          if (values.some(value => value === undefined)) {
            throw new Error("D1_TYPE_ERROR: Type 'undefined' not supported")
          }
          args = values
          return this
        },
        async all() { return { results: execute() } },
        async first() { return execute()[0] ?? null },
        async run() {
          execute()
          return { meta: { changes: 0, last_row_id: 1 } }
        },
      }
    },
    async batch(stmts: { run(): Promise<unknown> }[]) {
      return Promise.all(stmts.map(stmt => stmt.run()))
    },
  }
  const bucket = {
    async get(key: string) {
      const value = items.get(key)
      if (value === undefined) return null
      return {
        async json() { return JSON.parse(value) },
        async text() { return value },
      }
    },
    async put(key: string, value: string) { items.set(key, value) },
  }

  return {
    DB: db as unknown as D1Database,
    ITEMS_BUCKET: bucket as unknown as R2Bucket,
    AI: { run: vi.fn() },
    SCRAPE_ADMIN_TOKEN: 'test-admin-token',
    SESSION_SECRET: 'test-session-secret',
    DISCORD_CLIENT_ID: 'test-client-id',
    DISCORD_CLIENT_SECRET: 'test-client-secret',
    DISCORD_BOT_TOKEN: 'test-bot-token',
    DISCORD_REDIRECT_URI: 'https://test.local/api/auth/discord/callback',
    ...overrides,
    __queries: queries,
    __items: items,
  }
}
