import { fetchOpenedPRs } from '../../src/modules/opened-data.js'
import { fetchMergedPRs } from '../../src/modules/merged-data.js'

const TEAMS = ['GRID', 'FSM', 'TODOS', 'GRID Projetos', 'GRID Sustentação', 'FSM Projetos', 'FSM Sustentação']

const store = new Map()

export function get (key) {
  return store.get(key)?.data ?? null
}

export function set (key, data) {
  store.set(key, { data, time: Date.now() })
}

export async function refreshAll () {
  const today = new Date().toISOString().split('T')[0]
  const results = { opened: [], merged: [] }

  for (const team of TEAMS) {
    results.opened.push(
      fetchOpenedPRs(team)
        .then(data => { set(`opened:${team}`, data); console.log(`[cache] opened:${team} OK`) })
        .catch(err => console.error(`[cache] opened:${team} ERRO:`, err.message))
    )
    results.merged.push(
      fetchMergedPRs(team, today, today)
        .then(data => { set(`merged:${team}:${today}:${today}`, data); console.log(`[cache] merged:${team} OK`) })
        .catch(err => console.error(`[cache] merged:${team} ERRO:`, err.message))
    )
  }

  await Promise.all([...results.opened, ...results.merged])
}
