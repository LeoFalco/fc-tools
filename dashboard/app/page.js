'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'

const TEAMS = ['GRID', 'FSM', 'TODOS', 'GRID Projetos', 'GRID Sustentação', 'FSM Projetos', 'FSM Sustentação']

function StatusDot ({ ok, inProgress }) {
  if (inProgress) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" title="Em progresso" />
  return ok
    ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" title="OK" />
    : <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" title="Pendente" />
}

function OpenedTable ({ pulls, memberStats, totalPrs, avgAge }) {
  if (!pulls) return null
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="py-2 px-3">Autor</th>
              <th className="py-2 px-3">Título</th>
              <th className="py-2 px-3 text-center">Idade</th>
              <th className="py-2 px-3 text-center">Ready</th>
              <th className="py-2 px-3 text-center">Conflitos</th>
              <th className="py-2 px-3 text-center">CI</th>
              <th className="py-2 px-3 text-center">Aprovado</th>
              <th className="py-2 px-3 text-center">Qualidade</th>
            </tr>
          </thead>
          <tbody>
            {pulls.map((pull) => (
              <tr key={pull.url} className="border-b border-gray-800 hover:bg-gray-900">
                <td className="py-2 px-3 font-medium">{pull.author?.login}</td>
                <td className="py-2 px-3">
                  <a href={pull.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                    {pull.title.length > 70 ? pull.title.substring(0, 70) + '...' : pull.title}
                  </a>
                </td>
                <td className="py-2 px-3 text-center">{pull.age}d</td>
                <td className="py-2 px-3 text-center"><StatusDot ok={pull.ready} /></td>
                <td className="py-2 px-3 text-center"><StatusDot ok={pull.mergeable} /></td>
                <td className="py-2 px-3 text-center"><StatusDot ok={pull.checks} inProgress={pull.checksInProgress} /></td>
                <td className="py-2 px-3 text-center"><StatusDot ok={pull.approved} /></td>
                <td className="py-2 px-3 text-center"><StatusDot ok={pull.quality} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">PRs por membro</h3>
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="py-1 px-2">Membro</th>
                <th className="py-1 px-2 text-right">PRs</th>
                <th className="py-1 px-2 text-right">Mais velho</th>
              </tr>
            </thead>
            <tbody>
              {memberStats.map((m) => (
                <tr key={m.author} className="border-b border-gray-800">
                  <td className="py-1 px-2">{m.author}</td>
                  <td className="py-1 px-2 text-right">{m.count}</td>
                  <td className="py-1 px-2 text-right">{m.oldestAge}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-start gap-6 text-sm text-gray-400">
          <div>Total: <span className="text-white font-medium">{totalPrs}</span> PRs</div>
          <div>Idade média: <span className="text-white font-medium">{avgAge}</span> dias</div>
        </div>
      </div>
    </div>
  )
}

function MergedTable ({ pulls, memberStats }) {
  if (!pulls) return null
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="py-2 px-3">Autor</th>
              <th className="py-2 px-3">Título</th>
              <th className="py-2 px-3">Publicado em</th>
              <th className="py-2 px-3 text-right">Duração (dias úteis)</th>
            </tr>
          </thead>
          <tbody>
            {pulls.map((pull) => (
              <tr key={pull.url} className="border-b border-gray-800 hover:bg-gray-900">
                <td className="py-2 px-3 font-medium">{pull.author?.login}</td>
                <td className="py-2 px-3">
                  <a href={pull.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                    {pull.title}
                  </a>
                </td>
                <td className="py-2 px-3">{pull.mergedAt}</td>
                <td className="py-2 px-3 text-right">{pull.durationDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6">
        <h3 className="text-gray-400 text-sm font-medium mb-2">PRs por membro</h3>
        <table className="text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="py-1 px-2">Membro</th>
              <th className="py-1 px-2 text-right">PRs</th>
            </tr>
          </thead>
          <tbody>
            {memberStats.map((m) => (
              <tr key={m.author} className="border-b border-gray-800">
                <td className="py-1 px-2">{m.author}</td>
                <td className="py-1 px-2 text-right">{m.count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-600 text-gray-300 font-medium">
              <td className="py-1 px-2">Total</td>
              <td className="py-1 px-2 text-right">{pulls.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function Dashboard () {
  const { data: session, status } = useSession()
  const [tab, setTab] = useState('opened')
  const [team, setTeam] = useState('GRID')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Carregando...</div>
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <h1 className="text-3xl font-bold">FC Tools Dashboard</h1>
        <p className="text-gray-400">Acesso restrito a membros da Field Control</p>
        <button
          onClick={() => signIn('google')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
        >
          Entrar com Google
        </button>
      </div>
    )
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ team })
      if (tab === 'merged') {
        const today = new Date().toISOString().split('T')[0]
        params.set('from', today)
        params.set('to', today)
      }
      const res = await fetch(`/api/${tab}?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tab, team])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">FC Tools Dashboard</h1>
        <div className="flex items-center gap-4">
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
        >
          {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => signOut()}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Sair
        </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-700">
        <button
          onClick={() => setTab('opened')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'opened' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
        >
          Abertos
        </button>
        <button
          onClick={() => setTab('merged')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'merged' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
        >
          Publicados
        </button>
      </div>

      {loading && <div className="text-gray-400 py-8 text-center">Carregando...</div>}
      {error && <div className="text-red-400 py-8 text-center">Erro: {error}</div>}

      {!loading && !error && data && (
        tab === 'opened'
          ? <OpenedTable {...data} />
          : <MergedTable {...data} />
      )}
    </div>
  )
}
