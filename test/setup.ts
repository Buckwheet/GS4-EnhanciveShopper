import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Outbound fetch is disabled in tests; supply a fetch stub')
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})
