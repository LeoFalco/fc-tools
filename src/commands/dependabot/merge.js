import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { getOctokit } from '../../core/octokit.js'
import { $ } from '../../core/exec.js'
import { info } from '../../core/patch-console-log.js'

const { green, yellow, red, gray, bold } = chalk

const MANIFEST_PATTERNS = [
  'go.mod',
  'go.sum',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Gemfile',
  'Gemfile.lock',
  'requirements.txt',
  'poetry.lock',
  'Pipfile.lock',
  'composer.json',
  'composer.lock',
  'Cargo.toml',
  'Cargo.lock',
  'build.gradle',
  'pom.xml'
]

function isManifestFile (filename) {
  const base = filename.split('/').pop()
  if (MANIFEST_PATTERNS.includes(base)) return true
  if (filename.startsWith('.github/workflows/')) return true
  if (base.startsWith('Dockerfile')) return true
  return false
}

function parseVersionBump (title) {
  const match = title.match(/from\s+v?(\d+)\.(\d+)\.(\d+)\s+to\s+v?(\d+)\.(\d+)\.(\d+)/i)
  if (!match) return 'unknown'

  const [, oldMaj, oldMin, , newMaj, newMin] = match.map(Number)

  if (oldMaj !== newMaj) return 'major'
  if (oldMin !== newMin) return 'minor'
  return 'patch'
}

function isGitHubAction (title) {
  return /^bump\s+\S+\/\S+/i.test(title) || title.includes('actions/')
}

function isDevelopmentDep (title) {
  const devPatterns = [
    'eslint', 'prettier', 'jest', 'mocha', 'chai', 'vitest',
    'typescript', '@types/', 'lint', 'husky', 'commitlint',
    'stylelint', '@typescript-eslint', 'webpack', 'vite',
    'rollup', 'babel', 'postcss', 'tailwindcss', 'sass', 'nodemon'
  ]
  const lower = title.toLowerCase()
  return devPatterns.some(p => lower.includes(p))
}

function assessRisk (pr, ciStatus, onlyManifestFiles) {
  const bump = parseVersionBump(pr.title)
  const isAction = isGitHubAction(pr.title)
  const isDev = isDevelopmentDep(pr.title)
  const ciPassing = ciStatus === 'passing'
  const isSecurityPr = pr.labels.some(l =>
    l.name.toLowerCase().includes('security')
  )

  if (bump === 'major') {
    return { risk: 'high', bump, reason: 'major version bump' }
  }

  if (bump === 'unknown') {
    return { risk: 'medium', bump, reason: 'could not parse version bump' }
  }

  if (ciStatus === 'failing') {
    return { risk: 'medium', bump, reason: 'CI is failing' }
  }

  if (!onlyManifestFiles) {
    return { risk: 'high', bump, reason: 'unexpected files changed' }
  }

  if (!ciPassing) {
    if (bump === 'patch') {
      return { risk: 'medium', bump, reason: 'patch bump, CI pending' }
    }
    return { risk: 'medium', bump, reason: `${bump} bump, CI not passing` }
  }

  if (bump === 'patch') {
    return { risk: 'low', bump, reason: 'patch bump, CI passing' }
  }

  if (bump === 'minor') {
    if (isAction || isDev || isSecurityPr) {
      return { risk: 'low', bump, reason: `minor ${isAction ? 'action' : isDev ? 'dev dep' : 'security'} bump, CI passing` }
    }
    return { risk: 'medium', bump, reason: 'minor bump, CI passing' }
  }

  return { risk: 'medium', bump, reason: 'unclassified' }
}

async function getCiStatus (owner, repoName, ref) {
  try {
    const { data } = await getOctokit().rest.repos.getCombinedStatusForRef({
      owner,
      repo: repoName,
      ref
    })

    const checks = await getOctokit().rest.checks.listForRef({
      owner,
      repo: repoName,
      ref
    })

    const checkConclusions = checks.data.check_runs.map(c => c.conclusion)
    const statusStates = data.statuses.map(s => s.state)
    const allConclusions = [...checkConclusions, ...statusStates]

    const failures = [
      ...checks.data.check_runs
        .filter(c => c.conclusion === 'failure' || c.conclusion === 'error')
        .map(c => ({
          name: c.name,
          step: c.output?.title || null,
          message: c.output?.summary?.split('\n')[0] || null
        })),
      ...data.statuses
        .filter(s => s.state === 'failure' || s.state === 'error')
        .map(s => ({
          name: s.context,
          step: null,
          message: s.description || null
        }))
    ]

    if (allConclusions.length === 0) return { status: 'none', failures: [] }
    if (allConclusions.some(c => c === 'failure' || c === 'error')) return { status: 'failing', failures }
    if (allConclusions.every(c => c === 'success' || c === 'neutral' || c === 'skipped')) return { status: 'passing', failures: [] }
    return { status: 'pending', failures: [] }
  } catch {
    return { status: 'none', failures: [] }
  }
}

async function getChangedFiles (owner, repoName, prNumber) {
  const { data } = await getOctokit().rest.pulls.listFiles({
    owner,
    repo: repoName,
    pull_number: prNumber,
    per_page: 100
  })
  return data.map(f => f.filename)
}

async function approvePr (owner, repoName, prNumber) {
  await getOctokit().rest.pulls.createReview({
    owner,
    repo: repoName,
    pull_number: prNumber,
    event: 'APPROVE',
    body: '✅ Auto-approved by fc-tools dependabot merge (low risk)'
  })
}

async function mergePr (owner, repoName, prNumber) {
  await getOctokit().rest.pulls.merge({
    owner,
    repo: repoName,
    pull_number: prNumber,
    merge_method: 'squash'
  })
}

async function listOrgRepos (owner) {
  return getOctokit().paginate(getOctokit().rest.repos.listForOrg, {
    org: owner,
    sort: 'name',
    per_page: 100
  }).then(repos => repos.filter(repo => !repo.archived && !repo.fork))
}

async function detectCurrentRepo () {
  try {
    const repoSlug = await $('gh repo view --json nameWithOwner -q .nameWithOwner', { loading: false, disableLog: true })
    if (repoSlug && repoSlug.includes('/')) {
      const [owner, repo] = repoSlug.split('/')
      return { owner, repo }
    }
    return null
  } catch {
    return null
  }
}

async function scanPrs (owner, repos) {
  const candidates = []

  for (const repo of repos) {
    const spinner = ora({ text: `Scanning ${repo.name}...` }).start()

    const prs = await getOctokit().rest.pulls.list({
      owner,
      repo: repo.name,
      state: 'open',
      per_page: 100
    })

    const dependabotPrs = prs.data
      .filter(pr => pr.user.login === 'dependabot[bot]')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    if (dependabotPrs.length === 0) {
      spinner.stop()
      continue
    }

    spinner.succeed(`${repo.name} — ${dependabotPrs.length} Dependabot PR(s)`)

    for (const pr of dependabotPrs) {
      const [ci, files] = await Promise.all([
        getCiStatus(owner, repo.name, pr.head.sha),
        getChangedFiles(owner, repo.name, pr.number)
      ])

      const onlyManifest = files.every(f => isManifestFile(f))
      const assessment = assessRisk(pr, ci.status, onlyManifest)

      const riskColor = assessment.risk === 'low'
        ? green
        : assessment.risk === 'medium'
          ? yellow
          : red

      const entry = {
        repo: repo.name,
        pr: pr.number,
        title: pr.title,
        ...assessment,
        ci: ci.status
      }

      console.log(
        `  #${pr.number} ${pr.title}`,
        riskColor(`[${assessment.risk}]`),
        gray(`— ${assessment.reason}`)
      )

      for (const f of ci.failures) {
        const parts = [f.name, f.step, f.message].filter(Boolean)
        console.log(gray(`    └ ${parts.join(' — ')}`))
      }

      candidates.push(entry)
    }
  }

  return candidates
}

export async function mergeAction (options) {
  const current = await detectCurrentRepo()
  if (!current) {
    info('Not inside a GitHub repo.')
    return
  }

  const { owner } = current
  let repos

  if (options.all) {
    const spinner = ora(`Fetching repos for ${owner}...`).start()
    repos = await listOrgRepos(owner)
    spinner.succeed(`Found ${repos.length} repos`)
  } else {
    info(`Scanning current repo: ${owner}/${current.repo}`)
    repos = [{ name: current.repo }]
  }

  const candidates = await scanPrs(owner, repos)

  if (candidates.length === 0) {
    console.log(yellow('\nNo Dependabot PRs found.'))
    return
  }

  const riskColor = risk => risk === 'low'
    ? green
    : risk === 'medium'
      ? yellow
      : red

  console.log('')
  const { selected } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selected',
    message: 'Select PRs to approve and merge:',
    choices: candidates.map(c => ({
      name: `${c.repo}#${c.pr} ${c.title} ${riskColor(c.risk)(`[${c.risk}]`)}`,
      value: c,
      checked: c.risk === 'low'
    }))
  }])

  if (selected.length === 0) {
    console.log(yellow('\nNo PRs selected. Exiting.'))
    return
  }

  console.log(bold(`\nProcessing ${selected.length} PR(s)...\n`))

  const summary = { merged: [], errored: [] }

  for (const entry of selected) {
    try {
      await approvePr(owner, entry.repo, entry.pr)
      await mergePr(owner, entry.repo, entry.pr)
      console.log(green(`  ✓ ${entry.repo}#${entry.pr} — approved and merged`))
      summary.merged.push(entry)
    } catch (err) {
      console.log(red(`  ✗ ${entry.repo}#${entry.pr} — ${err.message}`))
      summary.errored.push({ ...entry, error: err.message })
    }
  }

  console.log(bold('\n═══ Summary ═══\n'))
  console.log(green(`  Merged:   ${summary.merged.length}`))
  console.log(red(`  Errors:   ${summary.errored.length}`))

  if (summary.errored.length > 0) {
    console.log(bold('\nErrors:'))
    for (const e of summary.errored) {
      console.log(red(`  ${e.repo}#${e.pr} — ${e.error}`))
    }
  }
}
