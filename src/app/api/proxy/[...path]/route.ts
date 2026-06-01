/**
 * Universal API proxy route.
 * Forwards requests from the browser to FlashProxy, injecting the server-side key.
 * Route: /api/proxy/{...any path}
 */

import { NextRequest, NextResponse } from 'next/server'

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://rapi.flashproxy.com/api/v1'

function getKey(): string {
  const key = process.env.FLASHPROXY_API_KEY
  if (!key) {
    throw new Error('FLASHPROXY_API_KEY is not configured')
  }
  return key
}

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const apiPath = '/' + path.join('/')
  const search = req.nextUrl.search

  const url = `${BASE_URL}${apiPath}${search}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getKey()}`,
    'Content-Type': 'application/json',
  }

  const idempotencyKey = req.headers.get('x-idempotency-key')
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey

  let body: string | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const text = await req.text()
    if (text) body = text
  }

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
  })

  const json = await upstream.json()
  return NextResponse.json(json, { status: upstream.status })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
