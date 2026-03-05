import { NextResponse } from 'next/server'
import { auth } from '../../../auth.js'
import { fetchMergedPRs } from '../../../../src/modules/merged-data.js'
import { get, set } from '../../../lib/cache.js'

export async function GET (request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const team = searchParams.get('team') || 'GRID'
  const today = new Date().toISOString().split('T')[0]
  const from = searchParams.get('from') || today
  const to = searchParams.get('to') || today
  const key = `merged:${team}:${from}:${to}`

  const cached = get(key)
  if (cached) return NextResponse.json(cached)

  try {
    const data = await fetchMergedPRs(team, from, to)
    set(key, data)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
