import { expect, test } from 'vitest'
import { call } from './helpers/app'
import { mockEnv } from './helpers/env'

test('DB rejects undefined bind arguments like D1', () => {
  const env = mockEnv()
  expect(() => env.DB.prepare('SELECT ?').bind(undefined))
    .toThrow("D1_TYPE_ERROR: Type 'undefined' not supported")
})

test('GET /api/health calls the real Worker', async () => {
  const response = await call(mockEnv(), 'GET', '/api/health')
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'ok' })
})

test('DB resolves rows and records executed statements, including batches', async () => {
  const env = mockEnv({ rows: (_sql, args) => args[0] === 7 ? [{ id: 7 }] : [] })
  expect(await env.DB.prepare('SELECT * WHERE id = ?').bind(7).all()).toMatchObject({ results: [{ id: 7 }] })
  expect(await env.DB.prepare('SELECT * WHERE id = ?').bind(7).first()).toEqual({ id: 7 })
  expect(await env.DB.prepare('SELECT * WHERE id = ?').bind(8).first()).toBeNull()
  const statements = [env.DB.prepare('INSERT INTO fixture VALUES (?)').bind(1), env.DB.prepare('DELETE FROM fixture')]
  expect(await env.DB.batch(statements)).toEqual([
    { meta: { changes: 0, last_row_id: 1 } },
    { meta: { changes: 0, last_row_id: 1 } },
  ])
  expect(env.__queries).toEqual([
    { sql: 'SELECT * WHERE id = ?', args: [7] },
    { sql: 'SELECT * WHERE id = ?', args: [7] },
    { sql: 'SELECT * WHERE id = ?', args: [8] },
    { sql: 'INSERT INTO fixture VALUES (?)', args: [1] },
    { sql: 'DELETE FROM fixture', args: [] },
  ])
})

test('R2 stores objects and returns JSON, text, or null', async () => {
  const env = mockEnv()
  expect(await env.ITEMS_BUCKET.get('missing')).toBeNull()
  await env.ITEMS_BUCKET.put('items.json', '[{"id":1}]')
  const object = await env.ITEMS_BUCKET.get('items.json')
  expect(await object?.json()).toEqual([{ id: 1 }])
  expect(await object?.text()).toBe('[{"id":1}]')
})

test('one prepared statement bound twice keeps distinct args in a batch', async () => {
  const env = mockEnv()
  const stmt = env.DB.prepare('UPDATE shop_items SET cost = ? WHERE id = ?')
  await env.DB.batch([stmt.bind(100, 'a'), stmt.bind(200, 'b')])
  expect(env.__queries.map(query => query.args)).toEqual([[100, 'a'], [200, 'b']])
  await stmt.run()
  expect(env.__queries[2].args).toEqual([])
})
