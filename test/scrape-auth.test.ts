import { expect, test, vi } from 'vitest'
import { call } from './helpers/app'
import { mockEnv } from './helpers/env'

test('unset admin token rejects Bearer undefined', async () => {
  const env = mockEnv({ SCRAPE_ADMIN_TOKEN: undefined })
  const response = await call(env, 'POST', '/api/trigger-scrape', {
    headers: { Authorization: 'Bearer undefined' },
  })
  expect(response.status).toBe(403)
  expect(env.__queries).toEqual([])
  expect(fetch).not.toHaveBeenCalled()
})

test('wrong admin token is rejected', async () => {
  const response = await call(mockEnv(), 'POST', '/api/trigger-scrape', {
    headers: { Authorization: 'Bearer wrong-token' },
  })
  expect(response.status).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
})

test('correct admin token enters the scrape with outbound fetch stubbed', async () => {
  const outbound = vi.fn().mockRejectedValue(new Error('fixture fetch failed'))
  vi.stubGlobal('fetch', outbound)
  const env = mockEnv()
  const response = await call(env, 'POST', '/api/trigger-scrape', {
    headers: { Authorization: 'Bearer test-admin-token' },
  })
  expect(response.status).toBe(200)
  expect(outbound).toHaveBeenCalled()
  expect(env.__queries.some(query => query.sql.startsWith('INSERT INTO scrape_log'))).toBe(true)
})
