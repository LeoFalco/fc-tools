// @ts-check

import chalk from 'chalk'
import chalkTable from 'chalk-table'
import { $ } from '../../core/exec.js'

const ORG = 'FieldControl'
const ADMIN = 'admin'

// Severidades do Dependabot da mais grave para a menos grave.
// A ordem define como cada nível aparece na coluna de vulnerabilidades.
const SEVERITIES = [
  { key: 'critical', color: chalk.magenta },
  { key: 'high', color: chalk.red },
  { key: 'medium', color: chalk.yellow },
  { key: 'low', color: chalk.blue }
]

class ReposCommand {
  /**
   * @param {Object} param
   * @param {import('commander').Command} param.program
   */
  install ({ program }) {
    program
      .command('repos')
      .description('list fieldcontrol repositories you can merge into')
      .action(this.action.bind(this))
  }

  async action () {
    const mergeableRepos = await fetchMergeableRepos()

    if (mergeableRepos.length === 0) {
      console.log(chalk.yellow(`Nenhum repositório da org ${ORG} com permissão de merge`))
      return
    }

    const rows = await Promise.all(mergeableRepos.map(withVulnerabilities))
    rows.sort(bySeverityDesc)

    printTable(rows)
  }
}

/**
 * Busca os repositórios da org em que o usuário tem permissão de merge,
 * ordenados por nome.
 * @returns {Promise<Array<{ repo: string, permission: string }>>}
 */
async function fetchMergeableRepos () {
  const repos = await $('gh api --paginate /user/repos?affiliation=organization_member', {
    json: true,
    loading: false
  })

  return (repos || [])
    // @ts-ignore
    .filter((repo) => repo.owner?.login?.toLowerCase() === ORG.toLowerCase())
    // @ts-ignore
    .filter((repo) => canMerge(repo.permissions))
    // @ts-ignore
    .map((repo) => ({ repo: repo.name, permission: highestPermission(repo.permissions) }))
    .sort((/** @type {{ repo: string }} */ a, /** @type {{ repo: string }} */ b) => a.repo.localeCompare(b.repo))
}

/**
 * Enriquece a linha do repositório com a contagem de vulnerabilidades.
 * Só consulta o Dependabot quando o usuário é admin (a API exige esse acesso).
 * Mantém `counts` na linha para permitir a ordenação por severidade.
 * @param {{ repo: string, permission: string }} row
 * @returns {Promise<{ repo: string, permission: string, counts: Record<string, number> | null, vulnerabilities: string }>}
 */
async function withVulnerabilities (row) {
  if (row.permission !== ADMIN) {
    return { ...row, counts: null, vulnerabilities: chalk.dim('-') }
  }

  const counts = await countVulnerabilities(row.repo)
  return { ...row, counts, vulnerabilities: formatVulnerabilities(counts) }
}

/**
 * Ordena as linhas colocando primeiro quem tem mais vulnerabilidades de alta
 * severidade, comparando critical, high, medium e low nessa ordem. Linhas sem
 * contagem (sem admin ou Dependabot indisponível) vão para o fim.
 * @param {{ counts: Record<string, number> | null }} a
 * @param {{ counts: Record<string, number> | null }} b
 * @returns {number}
 */
function bySeverityDesc (a, b) {
  if (!a.counts) return b.counts ? 1 : 0
  if (!b.counts) return -1

  for (const { key } of SEVERITIES) {
    const diff = (b.counts[key] || 0) - (a.counts[key] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Conta os Dependabot alerts abertos de um repositório, agrupados por severidade.
 * Retorna null quando o Dependabot está desabilitado ou o repo não é acessível.
 * @param {string} repo
 * @returns {Promise<Record<string, number> | null>}
 */
async function countVulnerabilities (repo) {
  const result = /** @type {{ success: boolean, stdout: string | undefined }} */ (await $(`gh api --paginate /repos/${ORG}/${repo}/dependabot/alerts?state=open&per_page=100`, {
    loading: false,
    reject: false,
    returnProperty: 'all'
  }))

  if (!result.success) return null

  const alerts = safeParseArray(result.stdout)
  /** @type {Record<string, number>} */
  const counts = { total: alerts.length }
  for (const { key } of SEVERITIES) {
    counts[key] = alerts.filter((alert) => alert?.security_advisory?.severity === key).length
  }
  return counts
}

/**
 * Formata a contagem de vulnerabilidades para exibição na tabela.
 * @param {Record<string, number> | null} counts
 * @returns {string}
 */
function formatVulnerabilities (counts) {
  if (counts === null) return chalk.dim('n/d')
  if (counts.total === 0) return chalk.green('0')

  const breakdown = SEVERITIES
    .filter(({ key }) => counts[key] > 0)
    .map(({ key, color }) => color(`${counts[key]} ${key}`))
    .join(', ')

  return `${chalk.bold(counts.total)} (${breakdown})`
}

/**
 * @param {Array<{ repo: string, permission: string, vulnerabilities: string }>} rows
 */
function printTable (rows) {
  console.log('')
  console.log(chalkTable({
    columns: [
      { field: 'repo', name: chalk.cyan('Repo') },
      { field: 'permission', name: chalk.cyan('Permissão') },
      { field: 'vulnerabilities', name: chalk.cyan('Vulnerabilidades') }
    ]
  }, rows))
  console.log('')
  console.log(chalk.dim(`${rows.length} repositórios`))
}

/**
 * @param {string | undefined} stdout
 * @returns {Array<any>}
 */
function safeParseArray (stdout) {
  if (!stdout) return []
  try {
    const parsed = JSON.parse(stdout)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * @param {{ admin?: boolean; maintain?: boolean; push?: boolean }} [permissions]
 * @returns {boolean}
 */
function canMerge (permissions) {
  return Boolean(permissions?.push || permissions?.maintain || permissions?.admin)
}

/**
 * @param {{ admin?: boolean; maintain?: boolean; push?: boolean }} permissions
 * @returns {string}
 */
function highestPermission (permissions) {
  if (permissions.admin) return ADMIN
  if (permissions.maintain) return 'maintain'
  return 'push'
}

export default new ReposCommand()
