import { NextResponse } from 'next/server'
import { auth } from '../../../auth.js'
import { fetchOpenedPRs } from '../../../../src/modules/opened-data.js'
import { get, set } from '../../../lib/cache.js'

export async function GET (request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const team = searchParams.get('team') || 'GRID'
  const key = `opened:${team}`

  const cached = get(key)
  if (cached) return NextResponse.json(cached)

  try {
    const data = await fetchOpenedPRs(team)
    set(key, data)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching opened PRs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
