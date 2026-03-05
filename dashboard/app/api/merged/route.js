import { NextResponse } from 'next/server'
import { auth } from '../../../auth.js'
import { fetchMergedPRs } from '../../../../src/modules/merged-data.js'

export const revalidate = 60

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

  try {
    const data = await fetchMergedPRs(team, from, to)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' }
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
