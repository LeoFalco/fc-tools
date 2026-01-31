// @ts-check

import { uniqBy } from 'lodash-es'
import { QUALITY_TEAM } from '../../core/constants.js'
import { $ } from '../../core/exec.js'
import { githubFacade } from '../../core/githubFacade.js'
import { fluxClient, STAGES } from '../../services/flux/flux-client.js'
import { coloredBoolean, hasPublishLabel, isApproved, isChecksPassed, isMergeable, isQualityOk, isReady, isRejected } from '../../utils/utils.js'
import chalk from 'chalk'
import { promptConfirm } from '../../utils/prompt.js'
import { sleep } from '../../utils/sleep.js'
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
      .option('--refresh', 'refresh pull request data while merging', false)
  }

  /**
   * @param {Object} options
   * @param {boolean} options.flux
   * @param {boolean} options.confirm
   * @param {boolean} options.continue
   * @param {boolean} options.refresh
   */
  async action (options) {
    console.log(blue('Starting PR merge process...'), JSON.stringify(options))
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
      console.log('  field merged --from=today --to=today --team=CMMS')

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
   * @param {boolean} options.refresh
   */
  async actionWithoutFlux (options) {
    console.log(blue('Merging pull request without flux'))

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
            json: true
          })
        )
      )
    ).flat()

    // 1. Try Admin Merge first (faster, ignores checks)
    const adminMergeExitCode = await $('gh pr merge --admin --squash --delete-branch')
      // @ts-ignore
      .then(result => result.exitCode)
      .catch(() => 1)

    const adminMerged = adminMergeExitCode === 0
    let merged = adminMerged

    // 2. Fallback to Auto Merge if Admin Merge failed
    if (!adminMerged) {
      console.log(yellow('Admin merge failed. Falling back to auto-merge...'))
      const autoMergeExitCode = await $('gh pr merge --squash --auto --delete-branch')
        // @ts-ignore
        .then(result => result.exitCode)
        .catch(() => 1)
      merged = autoMergeExitCode === 0
    }

    // 3. Cancel runs only if we successfully merged via Admin (bypassing them)
    if (adminMerged) {
      // @ts-ignore
      for (const { databaseId, displayTitle, workflowName } of runs) {
        console.log(blue(`Cancelling ${workflowName} • ${displayTitle}`))
        await $(`gh run cancel ${databaseId}`).catch(error => {
          console.log(red(`Failed to cancel run ${databaseId}: ${error.message}`))
        })
      }
    }

    // 4. Local branch cleanup
    if (merged) {
      await $('git checkout ' + defaultBranch)
      await $('git pull')
      await $('git remote prune origin')
      if (currentBranch !== defaultBranch) {
        await $('git branch -D ' + currentBranch, { reject: false })
      }
    }
  }
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
      const result = await $(`gh pr merge ${pullRequest.url} -d -r --admin`, { reject, stdio: 'pipe', loading: false, returnProperty: 'all' })

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
export default new PrMergeCommand()
