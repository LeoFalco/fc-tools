import { NextResponse } from 'next/server'
import { auth } from '../../../auth.js'
import { fetchOpenedPRs } from '../../../../src/modules/opened-data.js'

export const revalidate = 60

export async function GET (request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const team = searchParams.get('team') || 'GRID'

  try {
    const data = await fetchOpenedPRs(team)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' }
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
