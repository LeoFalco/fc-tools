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

function SortableHeader ({ label, field, sortField, sortDir, onSort, className = '' }) {
  const active = sortField === field
  return (
    <th
      className={`py-2 px-3 cursor-pointer select-none hover:text-gray-200 ${className}`}
      onClick={() => onSort(field)}
    >
      {label} {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  )
}

function OpenedTable ({ pulls }) {
  const [sortField, setSortField] = useState('score')
  const [sortDir, setSortDir] = useState('desc')

  if (!pulls) return null

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'author' ? 'asc' : 'desc')
    }
  }

  const sorted = [...pulls].sort((a, b) => {
    let cmp = 0
    if (sortField === 'author') {
      cmp = (a.author?.login || '').localeCompare(b.author?.login || '')
    } else if (sortField === 'age') {
      cmp = (a.age || 0) - (b.age || 0)
    } else {
      cmp = (a.score || 0) - (b.score || 0)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const headerProps = { sortField, sortDir, onSort: handleSort }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-left">
            <SortableHeader label="Autor" field="author" {...headerProps} />
            <th className="py-2 px-3">Título</th>
            <SortableHeader label="Idade" field="age" className="text-center" {...headerProps} />
            <SortableHeader label="Ready" field="score" className="text-center" {...headerProps} />
            <th className="py-2 px-3 text-center">Conflitos</th>
            <th className="py-2 px-3 text-center">CI</th>
            <th className="py-2 px-3 text-center">Aprovado</th>
            <th className="py-2 px-3 text-center">Qualidade</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pull) => (
            <tr key={pull.url} className="border-b border-gray-800 hover:bg-gray-900">
              <td className="py-2 px-3 font-medium">
                <div className="flex items-center gap-2">
                  <img src={`https://github.com/${pull.author?.login}.png?size=40`} alt="" className="w-5 h-5 rounded-full" />
                  {pull.author?.login}
                </div>
              </td>
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
  )
}

function StatsPanel ({ opened, merged }) {
  if (!opened) return null
  return (
    <div className="space-y-8">
      <div className="flex gap-4 text-sm">
        <div className="bg-gray-900 rounded-lg p-4 flex-1">
          <div className="text-gray-400 mb-1">PRs abertos</div>
          <div className="text-3xl font-bold text-white">{opened.totalPrs}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 flex-1">
          <div className="text-gray-400 mb-1">Idade média</div>
          <div className="text-3xl font-bold text-white">{opened.avgAge} <span className="text-lg text-gray-400">dias</span></div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 flex-1">
          <div className="text-gray-400 mb-1">Publicados hoje</div>
          <div className="text-3xl font-bold text-white">{merged?.pulls?.length ?? 0}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">PRs abertos por membro</h3>
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="py-1 px-2">Membro</th>
                <th className="py-1 px-2 text-right">PRs</th>
                <th className="py-1 px-2 text-right">Mais velho</th>
              </tr>
            </thead>
            <tbody>
              {opened.memberStats.map((m) => (
                <tr key={m.author} className="border-b border-gray-800">
                  <td className="py-1 px-2">
                    <div className="flex items-center gap-2">
                      <img src={`https://github.com/${m.author}.png?size=40`} alt="" className="w-5 h-5 rounded-full" />
                      {m.author}
                    </div>
                  </td>
                  <td className="py-1 px-2 text-right">{m.count}</td>
                  <td className="py-1 px-2 text-right">{m.oldestAge}d</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-600 text-gray-300 font-medium">
                <td className="py-1 px-2">Total</td>
                <td className="py-1 px-2 text-right">{opened.totalPrs}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {merged?.memberStats && (
          <div>
            <h3 className="text-gray-400 text-sm font-medium mb-2">Publicados hoje por membro</h3>
            <table className="text-sm w-full">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-left">
                  <th className="py-1 px-2">Membro</th>
                  <th className="py-1 px-2 text-right">PRs</th>
                </tr>
              </thead>
              <tbody>
                {merged.memberStats.map((m) => (
                  <tr key={m.author} className="border-b border-gray-800">
                    <td className="py-1 px-2">
                      <div className="flex items-center gap-2">
                        <img src={`https://github.com/${m.author}.png?size=40`} alt="" className="w-5 h-5 rounded-full" />
                        {m.author}
                      </div>
                    </td>
                    <td className="py-1 px-2 text-right">{m.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-600 text-gray-300 font-medium">
                  <td className="py-1 px-2">Total</td>
                  <td className="py-1 px-2 text-right">{merged.pulls.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
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
                <td className="py-2 px-3 font-medium">
                  <div className="flex items-center gap-2">
                    <img src={`https://github.com/${pull.author?.login}.png?size=40`} alt="" className="w-5 h-5 rounded-full" />
                    {pull.author?.login}
                  </div>
                </td>
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
                <td className="py-1 px-2">
                  <div className="flex items-center gap-2">
                    <img src={`https://github.com/${m.author}.png?size=40`} alt="" className="w-5 h-5 rounded-full" />
                    {m.author}
                  </div>
                </td>
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ team })
      if (tab === 'stats') {
        const today = new Date().toISOString().split('T')[0]
        const mergedParams = new URLSearchParams({ team, from: today, to: today })
        const [openedRes, mergedRes] = await Promise.all([
          fetch(`/api/opened?${params}`),
          fetch(`/api/merged?${mergedParams}`)
        ])
        if (!openedRes.ok) throw new Error(`HTTP ${openedRes.status}`)
        if (!mergedRes.ok) throw new Error(`HTTP ${mergedRes.status}`)
        const [opened, merged] = await Promise.all([openedRes.json(), mergedRes.json()])
        setData({ opened, merged })
      } else {
        if (tab === 'merged') {
          const today = new Date().toISOString().split('T')[0]
          params.set('from', today)
          params.set('to', today)
        }
        const res = await fetch(`/api/${tab}?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData(await res.json())
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tab, team])

  useEffect(() => { fetchData() }, [fetchData])

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
        <button
          onClick={() => setTab('stats')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'stats' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
        >
          Estatísticas
        </button>
      </div>

      {loading && <div className="text-gray-400 py-8 text-center">Carregando...</div>}
      {error && <div className="text-red-400 py-8 text-center">Erro: {error}</div>}

      {!loading && !error && data && (
        tab === 'opened'
          ? <OpenedTable {...data} />
          : tab === 'merged'
            ? <MergedTable {...data} />
            : <StatsPanel {...data} />
      )}
    </div>
  )
}
