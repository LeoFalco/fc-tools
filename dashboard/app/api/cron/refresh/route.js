import { NextResponse } from 'next/server'
import { refreshAll } from '../../../../lib/cache.js'

export const maxDuration = 300

export async function GET (request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  await refreshAll()
  const duration = ((Date.now() - start) / 1000).toFixed(1)

  return NextResponse.json({ ok: true, duration: `${duration}s` })
}
