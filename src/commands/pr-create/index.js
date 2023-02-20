import { execaCommand as exec } from 'execa'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import inquirer from 'inquirer'
import YAML from 'yaml'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Octokit } from 'octokit'

const CURRENT_DIR_NAME = dirname(fileURLToPath(import.meta.url))
const PR_DESCRIPTION_FILE_PATH = join(CURRENT_DIR_NAME, '../../../data/pr-description.txt')
const PR_DESCRIPTION_FOLDER_PATH = dirname(PR_DESCRIPTION_FILE_PATH)

class PrCreateCommand {
  install ({ program }) {
    program
      .command('pr').description('manage pull requests')
      .command('create').description('create a new pull request')
      .action(this.action)
  }

  async action () {
    const currentBranchName = await exec('git rev-parse --abbrev-ref HEAD').then(({ stdout }) => stdout.trim())
    await exec(`git push origin ${currentBranchName} -u -f --no-verify`)
    const repoPath = await exec('git rev-parse --show-toplevel').then(({ stdout }) => stdout.trim())

    const pullRequestDescription = await buildPullRequestDescription({
      repoPath,
      currentBranchName
    })

    const pullRequestTitle = await buildPullRequestTitle({
      repoPath
    })

    const repoNameWithOwner = await exec('gh repo view --json nameWithOwner --jq .nameWithOwner').then(({ stdout }) => stdout.trim())

    const [owner, repoName] = repoNameWithOwner.split('/')

    const octokit = new Octokit({
      auth: await exec('gh auth token').then(({ stdout }) => stdout.trim())
    })

    // const reviewers = [
    // 'FieldControl/Enterprise',
    // 'FieldControl/Fieldevelopers',
    // 'Arcaino',
    // 'brunohforcato',
    // 'caiorsantanna',
    // 'camargobiel',
    // 'Carlos-F-Braga',
    // 'gilmarferrini',
    // 'godinhojoao',
    // 'guilhermeviiniidev',
    // 'GutoRomagnolo',
    // 'helderlim',
    // 'jbrandao',
    // 'joaovictorlongo',
    // 'kweripx',
    // 'LeoFalco',
    // 'lfreneda',
    // 'ottonielmatheus',
    // 'satakedev',
    // 'sousxa',
    // 'victorreinor',
    // 'willaug'
    // ]

    const teams = await octokit.graphql(`
      query {
        organization(login: "${owner}") {
          teams(first: 10, role:MEMBER) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `)
    console.log('teams', teams)

    const scaped = escape(`gh api graphql -f query='query {
      viewer {
        organization(login: "${owner}") {
          teams(first: 100) {
            nodes {
                name
                members(first: 100) {
                  nodes {
                    login
                  }
                }
                repositories(first: 100, query: "${repoName}") {
                  nodes {
                    name
                  }
                }
              }
            }
          }
        }
      }'`)
    console.log('scaped', scaped)

    const result = await exec(scaped)

    console.log('result', result)

    // await mkdir(PR_DESCRIPTION_FOLDER_PATH, { recursive: true })
    // const result = await writeFile(PR_DESCRIPTION_FILE_PATH, pullRequestDescription)
    // console.log('pullRequestDescription', pullRequestDescription)
    // console.log('PR_DESCRIPTION_FILE_PATH', PR_DESCRIPTION_FILE_PATH)
    // console.log('result', result)

    // await exec(`gh pr create --assignee @me --title ${escape(pullRequestTitle)} --body-file ${PR_DESCRIPTION_FILE_PATH}  ${reviewers.length ? '--reviewers ' + reviewers.join(',') : ''}`)

    // const url = await exec('gh pr view --json url --jq .url').then(({ stdout }) => stdout.trim())

    // console.log(`INFO: pr opened ${url}`)
  }
}

function escape (text) {
  return text
    .replace(/\s+/g, ' ')// replace many spaces by one space
    .replace(/\s/g, '\\ ') // escape spaces
    .trim()
}

function issueNumberFromBranch ({ currentBranchName }) {
  const match = currentBranchName.match(/^(\d+)/)
  return match && match[0]
}

function capitalize (text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

async function getPullRequestPrefix ({ repoPath }) {
  const possiblePrefixes = await getPrefixFromFieldnewsWorkflow({ repoPath })

  if (!possiblePrefixes || possiblePrefixes.length === 0) {
    return null
  }

  if (possiblePrefixes.length === 1) {
    return possiblePrefixes[0]
  }

  const result = await inquirer.prompt([{
    message: 'Por favor escolha um prefixo para o pull request',
    name: 'selectedPrefix',
    type: 'list',
    choices: possiblePrefixes
  }])

  return result.selectedPrefix
}

async function getPrefixFromFieldnewsWorkflow ({ repoPath }) {
  const workflowFieldnewsPath = repoPath + '/.github/workflows/fieldnews.yml'
  const ymlString = await readFile(workflowFieldnewsPath, { encoding: 'utf8' }).catch(() => null)

  if (!ymlString) return null

  const workflow = YAML.parse(ymlString)
  const step = workflow.jobs['title-validation'].steps[0]

  if (step.with.allowed_prefixes) {
    return String(step.with.allowed_prefixes).split(',').map(value => value.trim())
  }

  if (step.with.script) {
    const line = step.with.script.split('\n').find(line => line.includes('ALLOWED_TITLE_PREFIXES'))
    if (line) {
      const lineReplaced = line.replace('const ALLOWED_TITLE_PREFIXES =', '')
      // eslint-disable-next-line no-eval
      const result = eval(lineReplaced)
      if (result && result.length) {
        return result.map(value => value.trim())
      }
    }
  }

  return null
}

async function buildPullRequestDescription ({ repoPath, currentBranchName }) {
  const prTemplatePath = repoPath + '/.github/pull_request_template.md'

  const prTemplate = await readFile(prTemplatePath, { encoding: 'utf8' }).catch(() => null)
  const issueNumber = issueNumberFromBranch({ currentBranchName })

  const closesMessage = issueNumber && `- closes #${issueNumber}`

  return [prTemplate, closesMessage].filter(Boolean).join('\n\n')
}

async function buildPullRequestTitle ({ repoPath }) {
  const prefix = await getPullRequestPrefix({ repoPath })

  const commitMessage = await exec('git log --pretty=%B -n 1')
    .then(({ stdout }) => stdout.replace(/.*:/, ''))
    .then((commitMessage) => commitMessage.split('\n')[0]) // pega a primeira linha
    .then((commitMessage) => commitMessage.trim())
    .then(capitalize)

  return [prefix, commitMessage].filter(Boolean).join(' ')
}

export default new PrCreateCommand()
