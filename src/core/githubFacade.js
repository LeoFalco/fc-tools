// @ts-check

import { red } from '../utils/utils.js'
import { octokit } from './octokit.js'

const GET_PULL_REQUESTS = `#graphql
      query listPullRequests($organization: String!, $repository: String!, $number: Int!) {
        viewer {
          organization(login: $organization) {
            repository(name: $repository) {
              id
              name
              pullRequest(number: $number) {
                id
                url
                number
                mergedAt
                mergeable
                createdAt
                state
                title
                isDraft
                reviewDecision
                baseRefName
                headRefName
                repository {
                  name
                }
                author {
                  login
                }
                labels(first: 5, orderBy: { field: NAME, direction: ASC }) {
                  nodes {
                    name
                  }
                }
                reviews(first: 10, states: [APPROVED, CHANGES_REQUESTED]) {
                  nodes {
                    state
                    author {
                      login
                    }
                  }
                }
                headRef {
                  target {
                    oid
                  }
                }
              }
            }
          }
        }
      }
    `

class GithubFacade {
  async getCurrentUser () {
    return await octokit.rest.users.getAuthenticated()
  }

  async getPullRequestComments ({ organization, repo, number }) {
    return await octokit.graphql(`
      query getPullRequestComments($organization: String!, $repo: String!, $number: Int!) {
        viewer {
          organization(login: $organization) {
            repository(name: $repo) {
              pullRequest(number: $number) {
                comments(first: 100) {
                  nodes {
                    id
                    author {
                      login
                    }
                    body
                  }
                }
              }
            }
          }
        }
      }
    `, { organization, repo, number })
      .then(response => response.viewer.organization.repository.pullRequest.comments.nodes)
  }

  /**
   * @param {object} params
   * @param {string} params.owner
   * @param {string} params.repo
   */
  async listWorkflowJobs ({ owner, repo }) {
    return await octokit.rest.actions
      .listWorkflowRunsForRepo({
        owner,
        repo,
        branch: 'master',
        per_page: 2,
        page: 1
      })
      .then((response) => response.data.workflow_runs)
      .then((runs) => {
        return runs.filter((run) => !run.head_commit?.committer?.email?.startsWith('fieldney@'))
      })
      .then((runs) => runs[0])
  }

  /**
   *
   * @param {object} params
   * @param {string} params.organization
   * @param {string[]} params.assignees
   * @param {string} params.state - 'OPEN' or 'CLOSED'
   * @param {string} params.from - 'YYYY-MM-DD'
   * @param {string} params.to - 'YYYY-MM-DD'
   * @returns
   */
  async listPullRequestsV2 (params) {
    const LIST_PRS_V2 = `#graphql
      query listPullRequestsByState($searchQuery: String!) {
        search(
          type: ISSUE
          query: $searchQuery
          first: 100
        ) {
          issueCount
          nodes {
            ... on PullRequest {
              id
              url
              mergedAt
              state
              title
              author {
                login
              }
              repository {
                name
                owner {
                  login
                }
              }
            }
          }
        }
      }
    `

    const pulls = []
    // for (const assignee of params.assignees) {
    try {
      // const searchQuery = `is:pr sort:merged-desc org:${params.organization} is:${params.state.toLowerCase()} merged:${params.from}..${params.to} author:${assignee}`
      const state = params.state.toLowerCase()
      const searchQuery = state === 'merged'
        ? `is:pr org:${params.organization} is:${state} merged:${params.from}..${params.to} sort:merged-desc`
        : `is:pr org:${params.organization} is:${state} created:${params.from}..${params.to} sort:created-desc`
      console.log('Query', searchQuery)
      const data = await octokit.graphql(LIST_PRS_V2, {
        searchQuery
      })

      console.log(`Total de pull requests encontrados na busca: ${data.search.issueCount}`)

      for (const pr of data.search.nodes) {
        pulls.push({
          number: pr.url.split('/').pop(),
          repo: pr.repository.name,
          url: pr.url,
          mergedAt: pr.mergedAt,
          author: pr.author?.login
        })
      }
    } catch (error) {
      console.warn(red('Erro ao buscar pull requests:' + error.message))
    }
    // }

    pulls.sort((a, b) => String(a.mergedAt).localeCompare(String(b.mergedAt)))

    // Filter by assignees
    const filteredByAssignee = pulls.filter(pr => params.assignees.includes(pr.author))

    // If only merged PRs are needed, filter by mergedAt
    let filteredPulls = filteredByAssignee
    if (params.state === 'MERGED') {
      filteredPulls = filteredByAssignee.filter(pr => pr.mergedAt)
    }

    console.log(`Filtrado ${filteredPulls.length} pull requests para os assignees selecionados.`)

    let pending = filteredPulls.length

    return Promise.all(
      filteredPulls.map(async (pull) => {
        return octokit.graphql(GET_PULL_REQUESTS, {
          organization: params.organization,
          repository: pull.repo,
          number: parseInt(pull.number)
        }).then((response) => {
          console.log(`consultado pull ${pull.url} (${--pending} restantes)`)
          return response.viewer.organization.repository.pullRequest
        })
      })
    ).then((pulls) => {
      console.log('Todos os pulls foram consultados, buscando checks...')
      let pending = pulls.length
      return Promise.all(
        pulls.map(async (pull) => {
          Object.assign(pull, {
            checks: pull.headRef ? await getChecks('FieldControl', pull.repository.name, pull.headRef.target.oid) : []
          })
          console.log(`check consultado ${pull.url} (${--pending} restantes)`)
          return pull
        })
      )
    })
  }

  async getPullRequest (params) {
    return octokit.graphql(GET_PULL_REQUESTS, {
      organization: params.organization,
      repository: params.repo,
      number: params.number
    }).then((response) => {
      return response.viewer.organization.repository.pullRequest
    }).then(async (pull) => {
      pull.checks = pull.headRef ? await getChecks('FieldControl', pull.repository.name, pull.headRef.target.oid) : []
      return pull
    })
  }

  async isAheadOfBase ({ owner, repo, baseRef, headRef }) {
    const compare = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: baseRef,
      head: headRef
    }).catch((error) => {
      console.warn('Error comparing commits:', error.status, error.message)
      return null
    })

    if (compare == null) return true

    return compare.data.ahead_by > 0
  }

  async rebasePullRequest ({ owner, repo, number }) {
    await octokit.rest.pulls.updateBranch({
      owner,
      repo,
      pull_number: number
    })
  }
}

export const getChecks = async (owner, repo, ref) => {
  return await octokit.rest.checks
    .listForRef({
      owner,
      repo,
      ref,
      per_page: 10,
      page: 1,
      filter: 'latest'
    })
    .then((response) => response.data.check_runs)
    .then((checks) => {
      checks.forEach((check) => {
        Reflect.deleteProperty(check, 'app')
        Reflect.deleteProperty(check, 'pull_requests')
        Reflect.deleteProperty(check, 'check_suite')
        Reflect.deleteProperty(check, 'output')
      })

      return checks
    })
}

const githubFacade = new GithubFacade()

export { githubFacade }
