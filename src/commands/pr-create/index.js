import { execaCommand as exec } from 'execa'
import { readFile } from 'node:fs/promises'
import inquirer from 'inquirer'
import YAML from 'yaml'

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

    const reviewers = [
      'FieldControl/Enterprise',
      'FieldControl/Fieldevelopers',
      'Arcaino',
      'brunohforcato',
      'caiorsantanna',
      'camargobiel',
      'Carlos-F-Braga',
      'gilmarferrini',
      'godinhojoao',
      'guilhermeviiniidev',
      'GutoRomagnolo',
      'helderlim',
      'jbrandao',
      'joaovictorlongo',
      'kweripx',
      'LeoFalco',
      'lfreneda',
      'ottonielmatheus',
      'satakedev',
      'sousxa',
      'victorreinor',
      'willaug'
    ]

    const createPrCommand = `gh pr create --assignee @me --title "${pullRequestTitle}" --body "${pullRequestDescription}" --reviewer ${reviewers.join(',')}`

    await exec(createPrCommand)

    const url = exec('gh pr view --json url --jq .url').then(({ stdout }) => stdout.trim())

    console.log(`INFO: pr opened ${url}`)
  }
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
