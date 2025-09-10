// @ts-check

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
   *
   * @param {object} params
   * @param {string} params.state
   * @param {string} params.organization
   * @param {string[]} params.assignees
   * @returns
   */
  async listPullRequests (params) {
    const LIST_MERGED_PULL_REQUESTS = `#graphql
      query listPullRequests($organization: String!, $states: [PullRequestState!]) {
        viewer {
          organization(login: $organization) {
            repositories(first: 40, isLocked: false, isFork: false, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                id
                name
                pullRequests(first: 5, states: $states, orderBy: { field: UPDATED_AT, direction: DESC }) {
                  nodes {
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
          }
        }
      }
    `

    const data = await octokit.graphql(LIST_MERGED_PULL_REQUESTS, {
      organization: params.organization,
      states: [params.state]
    })

    const pulls = data.viewer.organization.repositories.nodes
      .reduce((acc, repo) => acc.concat(repo.pullRequests.nodes), [])
      .filter((pull) => isAutorInSelectedAssigneeList(pull, params.assignees))

    await Promise.all(
      pulls.map(async (pull) => {
        pull.checks = pull.headRef ? await getChecks('FieldControl', pull.repository.name, pull.headRef.target.oid) : []
      })
    )

    return pulls
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
   * @returns
   */
  async listOpenPullRequestsV2 (params) {
    // Use GraphQL to fetch PRs for each assignee
    const LIST_PRS = `#graphql
      query listPullRequestsByState($organization: String!, $states: [PullRequestState!]) {
        viewer {
          organization(login: $organization) {
            repositories(first: 40, isLocked: false, isFork: false, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                name
                pullRequests(first: 10, states: $states, orderBy: { field: UPDATED_AT, direction: DESC }) {
                  nodes {
                    id
                    url
                    mergedAt
                    state
                    title
                    author { login }
                    repository { name owner { login } }
                  }
                }
              }
            }
          }
        }
      }
    `

    const state = params.state === 'MERGED' ? 'MERGED' : params.state
    const pulls = []
    try {
      const data = await octokit.graphql(LIST_PRS, {
        organization: params.organization,
        states: [state]
      })
      const repoNodes = data.viewer.organization.repositories.nodes
      for (const repo of repoNodes) {
        for (const pr of repo.pullRequests.nodes) {
          pulls.push({
            number: pr.url.split('/').pop(),
            repo: repo.name,
            url: pr.url,
            mergedAt: pr.mergedAt,
            author: pr.author?.login
          })
        }
      }
    } catch (error) {
      console.warn('Erro ao buscar pull requests:', error.message)
    }

    // Filter by assignees
    const filteredByAssignee = pulls.filter(pr => params.assignees.includes(pr.author))

    // If only merged PRs are needed, filter by mergedAt
    let filteredPulls = filteredByAssignee
    if (params.state === 'MERGED') {
      filteredPulls = filteredByAssignee.filter(pr => pr.mergedAt)
    }

    return Promise.all(
      filteredPulls.map(async (pull) => {
        console.log(`consultando pull ${pull.url}`)
        return octokit.graphql(GET_PULL_REQUESTS, {
          organization: params.organization,
          repository: pull.repo,
          number: parseInt(pull.number)
        }).then((response) => response.viewer.organization.repository.pullRequest)
      })
    ).then((pulls) => {
      return Promise.all(
        pulls.map(async (pull) => {
          console.log(`consultando check ${pull.url}`)
          Object.assign(pull, {
            checks: pull.headRef ? await getChecks('FieldControl', pull.repository.name, pull.headRef.target.oid) : []
          })
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

function isAutorInSelectedAssigneeList (pull, selectedAssignees) {
  return selectedAssignees.some((login) => {
    return (pull.author && login === pull.author?.login) || (pull.user && login === pull.user.login)
  })
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
