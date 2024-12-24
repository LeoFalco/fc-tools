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
  /**
   *
   * @param {object} params
   * @param {string} params.state
   * @param {string} params.organization
   * @param {string[]} params.assignees
   * @returns
   */
  async listPullRequests (params) {
    const LIST_PULL_REQUESTS = `#graphql
      query listPullRequests($organization: String!, $states: [PullRequestState!]) {
        viewer {
          organization(login: $organization) {
            repositories(first: 50, isLocked: false, isFork: false, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                id
                name
                pullRequests(first: 10, states: $states, orderBy: { field: CREATED_AT, direction: ASC }) {
                  nodes {
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
                    reviews(first: 20, states: [APPROVED, CHANGES_REQUESTED]) {
                      nodes {
                        state
                        author {
                          login
                        }
                      }
                    }
                    deployments(first: 2) {
                      nodes {
                        statuses(first: 1) {
                          nodes {
                            state
                            environmentUrl
                            logUrl
                            updatedAt
                          }
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
        }
      }
    `

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

    const data = await octokit.graphql(params.state === 'MERGED' ? LIST_MERGED_PULL_REQUESTS : LIST_PULL_REQUESTS, {
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
   * @returns
   */
  async listOpenPullRequestsV2 (params) {
    const searchPromises = params.assignees.map(async (assignee) => {
      console.log(`consultando pull requests de ${assignee}`)
      return octokit.rest.search.issuesAndPullRequests({ q: `is:pr is:open org:${params.organization} author:${assignee}` })
        .then((response) => {
          console.log(`Encontrado ${response.data.items.length} pull requests de ${assignee}`)
          return response
        })
    })

    const searchResults = await Promise.all(searchPromises)

    const pulls = []
    for (const { data: { items } } of searchResults) {
      for (const pr of items) {
        const url = pr.url
        const regexToExtractNumberAndRepo = /https:\/\/api\.github\.com\/repos\/FieldControl\/([a-z-_\d]+)\/issues\/(\d+)/
        console.log('pr', url)
        const [, repo, number] = url.match(regexToExtractNumberAndRepo) || []

        pulls.push({
          number: parseInt(number),
          repo,
          url
        })
      }
    }

    return Promise.all(
      pulls.map(async (pull) => {
        console.log(`consultando pull request ${pull.url}`)
        return octokit.graphql(GET_PULL_REQUESTS, {
          organization: params.organization,
          repository: pull.repo,
          number: pull.number
        }).then((response) => response.viewer.organization.repository.pullRequest)
      })
    ).then((pulls) => {
      return Promise.all(
        pulls.map(async (pull) => {
          console.log(`consultando checks do pull request ${pull.url}`)
          Object.assign(pull, {
            checks: pull.headRef ? await getChecks('FieldControl', pull.repository.name, pull.headRef.target.oid) : []
          })
          return pull
        })
      )
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
