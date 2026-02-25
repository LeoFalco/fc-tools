// @ts-check

import { uniqBy } from 'lodash-es'
import { QUALITY_TEAM } from '../../core/constants.js'
import { $ } from '../../core/exec.js'
import { githubFacade } from '../../core/githubFacade.js'
import { fluxClient, STAGES } from '../../services/flux/flux-client.js'
import { coloredBoolean, hasPublishLabel, isApproved, isChecksPassed, isMergeable, isQualityOk, isReady, isRejected, padEnd } from '../../utils/utils.js'
import chalk from 'chalk'
import { promptConfirm } from '../../utils/prompt.js'
import { sleep } from '../../utils/sleep.js'
import ora from 'ora'
const { red, yellow, green, gray, blue } = chalk

class PrMergeCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('merge')
      .description('merge pull request')
      .action(this.action.bind(this))
      .option('--flux', 'merge pull request with flux')
      .option('--confirm', 'execute merge without confirmation')
      .option('--continue', 'continue merging after a failed merge', false)
      .option('--admin', 'use admin merge', false)
      .option('--wait', 'wait for merge to complete', false)
      .option('--refresh', 'refresh pull request data while merging', false)
      .option('--approve', 'approve pull request before merging', false)
  }

  /**
   * @param {Object} options
   * @param {boolean} options.flux
   * @param {boolean} options.confirm
   * @param {boolean} options.continue
   * @param {boolean} options.admin
   * @param {boolean} options.wait
   * @param {boolean} options.refresh
   */
  async action (options) {
    console.log(blue('Starting PR merge process...'))
    if (options.flux) {
      await this.actionWithFlux(options)
    } else {
      await this.actionWithoutFlux(options)
    }
  }

  /**
   * @param {Object} options
   * @param {boolean} options.flux
   * @param {boolean} options.confirm
   * @param {boolean} options.continue
   * @param {boolean} options.admin
   * @param {boolean} options.refresh
   */
  async actionWithFlux (options) {
    console.log(blue('Using flux find pull requests'))

    const cards = await fluxClient.getUnopenedCards({
      stageId: STAGES.PUBLISH,
      take: 10,
      skip: 0
    })

    if (!cards || cards.length === 0) {
      console.log(gray('No cards found in publish stage'))
      return
    }

    for (const card of cards) {
      await extractPrData(card)
    }

    console.log(blue(`Found ${cards.length} cards. Do you want to merge them?`))

    const confirmed = await Promise.race([
      promptConfirm(options),
      sleep(5000)
    ])

    if (confirmed) {
      for (const card of cards) {
        await mergeCardPrs(card, options)
        await moveCardToMergedStage(card)
      }

      console.log(green('All done!'))
      console.log('You can check the cards at https://app.fluxcontrol.com.br/#/fluxo/b23ec9c8-8aeb-471a-8b2f-cd1af4f5e73e?view_mode=table')
      console.log('you can check the jobs with')
      console.log('  field merged --from=today --to=today --team=GRID')

      const everyCardMoved = cards.every(card => card.moved === true)
      if (everyCardMoved) {
        console.log(green('All cards were moved to merged stage'))
        process.exit(0)
      } else {
        console.log(yellow('Some cards were not moved to merged stage'))
      }
    } else {
      console.log('Merge operation not confirmed')
    }

    if (options.refresh) {
      console.log(blue('Refreshing pull request data...'))
      console.clear()
      if (options.confirm) {
        await sleep(1000)
      }
      this.actionWithFlux(options)
    }
  }

  /**
   * @param {Object} options
   * @param {boolean} options.flux
   * @param {boolean} options.confirm
   * @param {boolean} options.continue
   * @param {boolean} options.admin
   * @param {boolean} options.refresh
   * @param {boolean} options.wait
   * @param {boolean} options.approve
   */
  async actionWithoutFlux (options) {
    console.log(blue('Merging pull request without flux'))

    const prUrl = await $('gh pr view --json url --jq .url', { loading: false, disableLog: true })

    console.log(blue(`Pull request ${prUrl}`))

    const remoteInfo = await $('git remote show origin')
    // @ts-ignore
    const defaultBranch = remoteInfo?.match(/HEAD branch: (.*)/)?.[1] || 'master'
    const currentBranch = await $('git branch --show-current')

    console.log(blue(`Ready to merge branch ${currentBranch} into ${defaultBranch}`))

    const confirmMerge = await promptConfirm({
      confirm: options.confirm,
      message: `Você tem certeza que deseja prosseguir? ${currentBranch} -> ${defaultBranch}`
    })

    if (!confirmMerge) {
      console.log('Merge operation not confirmed')
      return
    }

    const runStatuses = ['in_progress', 'queued', 'pending']
    const runs = (
      await Promise.all(
        runStatuses.map(status =>
          $(`gh run list --branch ${currentBranch} --json databaseId,displayTitle,workflowName --status ${status}`, {
            json: true,
            loading: false
          })
        )
      )
    ).flat()

    if (options.approve) {
      await approve({ currentBranch })
    }

    // 1. Try Admin Merge first (faster, ignores checks)
    const mergeStatus = await merge({ admin: options.admin })

    if (mergeStatus === 'failed') {
      console.log(red('Merge operation failed'))
      return
    }

    if (mergeStatus === 'pending') {
      console.log(yellow('Merge operation is pending'))

      if (options.wait) {
        console.log(blue('Waiting for merge to complete...'))
        await waitForMergeCompletion({ currentBranch })
      }

      return
    }

    if (mergeStatus === 'done') {
      console.log(green('Merge operation completed'))
    }

    console.log(blue('Canceling runs'))
    // @ts-ignore
    await Promise.allSettled(runs.map(run => $(`gh run cancel ${run.databaseId}`, { loading: false })))

    console.log(blue('Local branch cleanup'))
    await $('git checkout ' + defaultBranch)
    await $('git pull')
    await $('git remote prune origin')
    if (currentBranch !== defaultBranch) {
      await $('git branch -D ' + currentBranch, { reject: false })
    }
  }
}

/**
 * @param {Object} options
 * @param {boolean} options.admin
 */
async function merge ({ admin }) {
  const mergeTypes = [
    {
      priority: 1,
      name: 'normal',
      command: 'gh pr merge --squash --delete-branch',
      message: 'Trying normal merge',
      failMessage: 'Normal merge failed',
      successMessage: 'Normal merge completed',
      mergeStatus: 'done'
    },
    {
      priority: 2,
      name: 'auto',
      command: 'gh pr merge --squash --auto --delete-branch',
      message: 'Trying auto merge',
      failMessage: 'Auto merge failed',
      successMessage: 'Auto merge enabled',
      mergeStatus: 'pending'
    },
    {
      priority: admin ? 0 : 3,
      name: 'admin',
      command: 'gh pr merge --admin --squash --delete-branch',
      message: 'Trying admin merge',
      failMessage: 'Admin merge failed',
      successMessage: 'Admin merge completed',
      mergeStatus: 'done'
    }
  ]

  mergeTypes.sort((a, b) => a.priority - b.priority)

  for (const mergeType of mergeTypes) {
    console.log(blue(mergeType.message))
    const result = await $(mergeType.command, {
      stdio: 'pipe',
      reject: false,
      returnProperty: 'all',
      loading: false
    })

    // @ts-ignore
    if (result.exitCode !== 0) {
      console.log(yellow(mergeType.failMessage))
      // @ts-ignore
      console.log(red(result.stderr))
    }

    // @ts-ignore
    if (result.exitCode === 0) {
      console.log(green(mergeType.successMessage))
      // @ts-ignore
      console.log(result.stdout)
      return mergeType.mergeStatus
    }
  }

  console.log(yellow('All merge types failed'))

  return 'failed'
}

const githubPrUrlRegex = /https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull\/(?<number>\d+)/gmi

// @ts-ignore
async function extractPrData (card) {
  card.name = card.name.trim()
  card.pullRequests = []

  card.fields = await fluxClient.getCardFields({ cardId: card.id })
    // @ts-ignore
    .then(fields => fields.filter(field => field.title && field.value))

  console.log('---------------------------------')
  console.log(blue('Card:', card.name))

  const description = String(card.description || '')
    .concat('\n\n')
    // @ts-ignore
    .concat(card.fields.map(field => field.name + ': ' + field.value).join('\n'))

  for (const match of description.matchAll(githubPrUrlRegex)) {
    if (match.groups == null) continue
    card.pullRequests.push({
      url: match[0],
      owner: match.groups.owner,
      repo: match.groups.repo,
      number: Number(match.groups.number)
    })
  }

  card.pullRequests = uniqBy(card.pullRequests, 'url')

  for (const pr of card.pullRequests) {
    const pull = await githubFacade.getPullRequest({
      organization: pr.owner,
      repo: pr.repo,
      number: pr.number
    })

    const approved = isApproved(pull)
    const notRejected = !isRejected(pull)
    const mergeable = isMergeable(pull)
    const checks = isChecksPassed(pull)
    const quality = isQualityOk(pull, QUALITY_TEAM) || hasPublishLabel(pull)
    const ready = isReady(pull)
    const publish = approved && notRejected && mergeable && checks && quality && ready
    const ahead = await githubFacade.isAheadOfBase({
      baseRef: pull.baseRefName,
      headRef: pull.headRefName,
      owner: pr.owner,
      repo: pr.repo
    })

    Object.assign(pr, {
      $metadata: {
        approved,
        notRejected,
        mergeable,
        checks,
        quality,
        ready,
        ahead,
        publish
      }
    })
  }

  if (card.pullRequests.length === 0) {
    console.log(yellow('  - No pull requests found in description.'))
  }

  card.pullRequests.forEach((/** @type {{ $metadata: ArrayLike<any> | { [s: string]: any; }; url: any; }} */ pull) => {
    /**
     * @type {string[]}
     */
    const notes = []
    Object.entries(pull.$metadata).forEach(([key, value]) => {
      notes.push(coloredBoolean({ [key]: value }))
    })
    console.log(blue(`  - ${pull.url}`))
    console.log(blue(`    ${notes.join(' ')}`))
  })

  return card
}

/**
 * @param {{ name: any; pullRequests: string | any[]; id: any; }} card
 * @param {{ flux?: boolean; confirm?: boolean; continue: any; refresh?: boolean; }} options
 */
async function mergeCardPrs (card, options) {
  console.log('----------------------------------')
  console.log('Card:', card.name)
  console.log('Merging card pull requests')

  if (card.pullRequests.length === 0) {
    console.log(yellow('  No pull requests found'))
  }
  for (const pullRequest of card.pullRequests) {
    console.log(blue(`  - ${pullRequest.url}`))
    await githubFacade.rebasePullRequest({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      number: pullRequest.number
    }).catch(() => {
      console.log(yellow('    [ignored] Rebase failed'))
    })

    if (!pullRequest.$metadata.publish) {
      console.log(yellow('    Skipped merge publish conditions not met'))
      continue
    }

    const reject = !options.continue
    // @ts-ignore
    const { state } = await $(`gh pr view ${pullRequest.url} --json state`, { stdio: 'pipe', loading: false, json: true })
    console.log(blue(`    State is ${state}`))

    const isOpen = state.includes('OPEN')
    if (isOpen) {
      const result = await $(`gh pr merge ${pullRequest.url} -d -s --admin`, { reject, stdio: 'pipe', loading: false, returnProperty: 'all' })

      // @ts-ignore
      if (!result.success) {
        // @ts-ignore
        console.log(red('    ' + result.stderr?.trim()))
        continue
      }

      const job = await githubFacade.listWorkflowJobs({
        owner: pullRequest.owner,
        repo: pullRequest.repo
      })

      await fluxClient.createCardComment({
        cardId: card.id,
        content: `Pull request ${pullRequest.url} merged successfully. ${job?.html_url}`
      })
    }

    const comments = await githubFacade.getPullRequestComments({
      organization: pullRequest.owner,
      repo: pullRequest.repo,
      number: pullRequest.number
    })

    // @ts-ignore
    const hasFluxCardComment = comments.some(comment => comment.body.includes('Flux: https://app.fluxcontrol.com.br/#/fluxo/b23ec9c8-8aeb-471a-8b2f-cd1af4f5e73e?view_mode=table&panel=card-detail&cardId='))

    if (!hasFluxCardComment) {
      await $(`gh pr comment ${pullRequest.url} --body Flux:\\ https://app.fluxcontrol.com.br/#/fluxo/b23ec9c8-8aeb-471a-8b2f-cd1af4f5e73e?view_mode=table&panel=card-detail&cardId=${card.id}`, { reject, stdio: 'ignore', loading: false })
      console.log(green('Added Flux comment to pull request'))
    }
  }
}

/**
 *
 * @param {Object} card
 * @param {string} card.id
 * @param {string} card.name
 * @param {Array<{ owner: string; repo: string; number: number; }>} card.pullRequests
 * @param {Object} card.currentStage
 * @param {string} card.currentStage.id
 *
 * @returns {Promise<boolean>} - returns true if the card was moved, false otherwise
 */
async function moveCardToMergedStage (card) {
  console.log('Moving card to published stage')

  const allPullRequests = await Promise.all(card.pullRequests.map(pr => githubFacade.getPullRequest({
    organization: pr.owner,
    repo: pr.repo,
    number: pr.number
  })))

  const states = allPullRequests.map(pr => pr.state)
  console.log(`  States are ${states.join(' ')}`)

  const everyPullRequestIsMergedOrClosed = allPullRequests.every(pr => pr.state === 'MERGED' || pr.state === 'CLOSED')

  if (!everyPullRequestIsMergedOrClosed) {
    console.log(red('  Skipped stage change'))
    return false
  }

  await fluxClient.moveCardToStage({
    cardId: card.id,
    afterStageId: STAGES.MERGED,
    beforeStageId: card.currentStage.id,
    nextCardId: null
  })

  console.log(green('  Card moved'))

  Object.assign(card, {
    moved: true
  })

  return true
}

/**
 * @param {Object} options
 * @param {string} options.currentBranch
 */
async function waitForMergeCompletion ({ currentBranch }) {
  const maxRetries = 300
  let retries = 0

  const loading = ora({ text: 'Waiting for merge completion' })
    .start()

  while (retries < maxRetries) {
    await sleep(1000)

    const state = await $('gh pr view ' + currentBranch + ' --json state --jq .state', { loading: false, disableLog: true })

    const statusCheckRollup = await $('gh pr view ' + currentBranch + ' --json statusCheckRollup --jq .statusCheckRollup', { loading: false, disableLog: true, json: true })
      .then((result) => {
        // @ts-ignore
        return result.map((item) => {
          return {
            name: item.name,
            status: item.status.toLowerCase(),
            conclusion: item.conclusion.toLowerCase(),
            detailsUrl: item.detailsUrl
          }
          // @ts-ignore
        }).sort((a, b) => a.name.localeCompare(b.name))
      })

    // @ts-ignore
    const statusMaxWidth = Math.max(...statusCheckRollup.map((item) => item.status.length))
    // @ts-ignore
    const conclusionMaxWidth = Math.max(...statusCheckRollup.map((item) => item.conclusion.length))
    // @ts-ignore
    statusCheckRollup.forEach((item) => {
      item.status = padEnd(item.status, statusMaxWidth)
      item.conclusion = padEnd(item.conclusion, conclusionMaxWidth)
    })

    const text = ['Waiting for merge completion state is ' + blue(state), '']

    statusCheckRollup.forEach((/** @type {{ name: string; conclusion: string; status: string; detailsUrl: string; }} */ item) => {
      const status = item.status || 'pending'
      const color = status.includes('success') || status.includes('completed') ? green : status.includes('failure') ? red : yellow
      text.push('- ' + color(status) + ' ' + item.name + ' ' + gray(item.detailsUrl))
    })

    loading.text = text.join('\n')

    const someCheckFailed = statusCheckRollup.some((/** @type {{ conclusion: string; }} */ item) => item.conclusion === 'failure')
    if (someCheckFailed) {
      console.log(text.join('\n'))
      loading.stopAndPersist({
        symbol: '⚠',
        text: red('Merge operation failed')
      })
      break
    }

    if (state === 'MERGED') {
      console.log(text.join('\n'))
      loading.stopAndPersist({
        symbol: '✔',
        text: green('Merge operation completed')
      })
      break
    }

    if (state !== 'OPEN') {
      console.log(text.join('\n'))
      loading.stopAndPersist({
        symbol: '⚠',
        text: red('Merge operation not completed')
      })
      break
    }

    retries++
  }

  if (retries === maxRetries) {
    loading.warn('Merge operation not completed after 5 minutes')
  }
}

/**
 * @param {Object} options
 * @param {string} options.currentBranch
 */
async function approve ({ currentBranch }) {
  console.log(blue('Approving pull request'))

  const reviewDecision = await $('gh pr view ' + currentBranch + ' --json reviewDecision --jq .reviewDecision')

  if (reviewDecision === 'APPROVED') {
    console.log(green('Pull request already approved'))
    return
  }

  const hasMyReview = await $('gh pr view ' + currentBranch + ' --json reviews', { json: true })
    // @ts-ignore
    .then(result => {
      console.log(result)
      return result?.reviews.some(review => review.author.login === 'LeoFalco' && review.state === 'APPROVED')
    })

  if (!hasMyReview) {
    await $('gh pr review ' + currentBranch + ' --approve', { stdio: 'inherit', loading: false, reject: false })
    console.log(green('Pull request approved'))
  }
}

export default new PrMergeCommand()
