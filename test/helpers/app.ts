import worker from '../../src/index'
import type { Env } from '../../src/types'

export async function call(
  env: Env,
  method: string,
  path: string,
  opts: { body?: unknown; headers?: HeadersInit } = {},
): Promise<Response> {
  const headers = new Headers(opts.headers)
  if (opts.body !== undefined) headers.set('content-type', 'application/json')
  const req = new Request('https://test.local' + path, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const ctx = { props: {}, waitUntil() {}, passThroughOnException() {} }
  return worker.fetch(req, env, ctx)
}
