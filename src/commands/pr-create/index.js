// @ts-check

import inquirer from 'inquirer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Octokit } from 'octokit'
import YAML from 'yaml'
import { $ } from '../../core/exec.js'
import { generateFieldNewsSuggestion } from '../../services/open-ai-api.js'

const CURRENT_DIR_NAME = dirname(fileURLToPath(import.meta.url))
const PR_DESCRIPTION_FILE_PATH = join(CURRENT_DIR_NAME, '../../../data/pr-description.txt')
const PR_DESCRIPTION_FOLDER_PATH = dirname(PR_DESCRIPTION_FILE_PATH)

class PrCreateCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('pr')
      .description('manage pull requests')
      .command('create')
      .description('create a new pull request based con current branch')
      .option('-g, --generate,', 'use ia to generate pr description')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   * @param {boolean | undefined} options.generate
   */
  async action (options) {
    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')

    await $(`git push origin ${currentBranchName} -u -f --no-verify`)
    const token = await $('gh auth token')
    const octokit = new Octokit({ auth: token })

    const repoNameWithOwner = await $('gh repo view --json nameWithOwner --jq .nameWithOwner')

    const [owner, repoName] = repoNameWithOwner.split('/')

    const repo = await octokit.rest.repos.get({
      owner,
      repo: repoName
    })

    const repoDescription = repo.data.description
    const commitMessage = await $('git log --pretty=%B -n 1')

    const repoPath = await $('git rev-parse --show-toplevel')

    const pullRequestDescription = await buildPullRequestDescription({
      repoPath,
      currentBranchName
    })

    const pullRequestTitle = await buildPullRequestTitle({
      repoPath,
      commitMessage
    })

    const completion = options.generate && await generateFieldNewsSuggestion({
      implementation: pullRequestTitle,
      repoDescription
    })

    const query = `#graphql
      query {
        organization(login: "${owner}") {
          myTeams: teams(first: 10, role: MEMBER) {
            nodes {
              slug
              members(first: 50) {
                nodes {
                  login
                }
              }
            }
          }
          repoTeams: teams(first: 10) {
            nodes {
              slug
              members(first: 50) {
                nodes {
                  login
                }
              }
              repositories(first: 10, query: "${repoName}") {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    `

    const teams = await octokit.graphql(query)
      .catch((err) => {
        console.warn(`Failed do request teams\n${err.message}`)
        return null
      })

    const myTeams = teams ? teams.organization.myTeams.nodes : []
    const repoTeams = teams ? teams.organization.repoTeams.nodes.filter(repo => repo.repositories.nodes.length) : []

    const allTeams = (teams ? myTeams.concat(repoTeams) : []).filter(team => {
      return team.slug !== 'fieldevelopers'
    })

    console.info('My teams: ' + myTeams.map(team => team.slug).join(', '))
    console.info('Repo teams: ' + repoTeams.map(team => team.slug).join(', '))

    const teamMap = {}
    for (const team of allTeams) {
      const teamName = owner + '/' + team.slug
      if (teamMap[teamName]) continue

      const teamMembers = team.members.nodes.map(member => member.login)
      teamMap[teamName] = teamMembers

      console.info(`Team ${teamName} members: ${teamMembers.join(', ')}`)
    }

    const teamNames = Object.keys(teamMap)
    const teamMembers = Object.values(teamMap).flat()

    const reviewers = teamNames.concat(teamMembers)

    await mkdir(PR_DESCRIPTION_FOLDER_PATH, { recursive: true })
    await writeFile(PR_DESCRIPTION_FILE_PATH, options.generate ? completion : pullRequestDescription)

    await $(`gh pr create --assignee @me --title ${escape(pullRequestTitle)} --body-file ${PR_DESCRIPTION_FILE_PATH}${reviewers.length ? ' --reviewer ' + reviewers.join(',') : ''}`)
      .catch((err) => {
        console.error(`Failed to open pr.\n${err.message}`)
        process.exit(1)
      })

    const url = await $('gh pr view --json url --jq .url')

    console.info(`pr opened ${url}`)
  }
}

function escape (text) {
  return text
    .replace(/\s+/g, ' ') // replace many spaces by one space
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

  const result = await inquirer.prompt([
    {
      message: 'Por favor escolha um prefixo para o pull request',
      name: 'selectedPrefix',
      type: 'list',
      choices: possiblePrefixes
    }
  ])

  return result.selectedPrefix
}

async function getPrefixFromFieldnewsWorkflow ({ repoPath }) {
  const workflowFieldnewsPath = repoPath + '/.github/workflows/fieldnews.yml'
  const ymlString = await readFile(workflowFieldnewsPath, {
    encoding: 'utf8'
  }).catch(() => null)

  if (!ymlString) return null

  const workflow = YAML.parse(ymlString)
  const step = workflow.jobs['title-validation'].steps[0]

  if (step.with.allowed_prefixes) {
    return String(step.with.allowed_prefixes)
      .split(',')
      .map((value) => value.trim())
  }

  if (step.with.script) {
    const line = step.with.script
      .split('\n')
      .find((line) => line.includes('ALLOWED_TITLE_PREFIXES'))
    if (line) {
      const lineReplaced = line.replace('const ALLOWED_TITLE_PREFIXES =', '')
      // eslint-disable-next-line no-eval
      const result = eval(lineReplaced)
      if (result && result.length) {
        return result.map((value) => value.trim())
      }
    }
  }

  return null
}

async function buildPullRequestDescription ({ repoPath, currentBranchName }) {
  const prTemplatePath = repoPath + '/.github/pull_request_template.md'

  const prTemplate = await readFile(prTemplatePath, { encoding: 'utf8' })
    .catch(() => null)

  const issueNumber = issueNumberFromBranch({ currentBranchName })

  const closesMessage = issueNumber && `- closes #${issueNumber}`

  return [prTemplate, closesMessage].filter(Boolean).join('\n\n')
}

async function buildPullRequestTitle ({ repoPath, commitMessage }) {
  const prefix = await getPullRequestPrefix({ repoPath })

  commitMessage = commitMessage
    .replace(/.*:/, '')
    .split('\n')[0]
    .trim()

  return [prefix, capitalize(commitMessage)].filter(Boolean).join(' ')
}

export default new PrCreateCommand()
