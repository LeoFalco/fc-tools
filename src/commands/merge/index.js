// @ts-check

import inquirer from 'inquirer'
import { uniqBy } from 'lodash-es'
import { QUALITY_TEAM } from '../../core/constants.js'
import { $ } from '../../core/exec.js'
import { githubFacade } from '../../core/githubFacade.js'
import { fluxClient, STAGES } from '../../services/flux/flux-client.js'
import { coloredBoolean, hasPublishLabel, isApproved, isChecksPassed, isMergeable, isQualityOk, isReady, isRejected } from '../../utils/utils.js'
import chalk from 'chalk'
const { red, yellow, green, gray, blue } = chalk
// const { red, yellow, green, gray, blue } = chalk

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
  }

  /**
   * @param {Object} options
   */
  async action (options) {
    if (options.flux) {
      await this.actionWithFlux(options)
    } else {
      await this.actionWithoutFlux(options)
    }
  }

  async actionWithFlux (options) {
    console.log(blue('Using flux find pull requests'))

    const cards = await fluxClient.getUnopenedCards({
      stageId: STAGES.PUBLISH,
      // stageId: STAGES.MERGED,
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

    const confirmed = options.confirm || await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `Found ${cards.length} cards. Do you want to merge them?`,
      default: false
    }).then(answer => answer.confirm)

    if (!confirmed) {
      console.log('Merge operation not confirmed exiting.')
      return
    }

    for (const card of cards) {
      await mergeCardPrs(card, options)
      await moveCardToMergedStage(card)
    }
  }

  async actionWithoutFlux (options) {
    const currentBranch = await $('git branch --show-current')
    await $('gh pr review --approve', { reject: false })
    await $('gh pr merge -d -r --admin')
    await $(`git branch -D ${currentBranch}`, { reject: false })
    await $('git remote prune origin')
    await $('npm install')

    console.log('PR merged successfully')
  }
}

const githubPrUrlRegex = /https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull\/(?<number>\d+)/gmi

async function extractPrData (card) {
  card.name = card.name.trim()
  card.pullRequests = []

  card.fields = await fluxClient.getCardFields({ cardId: card.id })
    .then(fields => fields.filter(f => f.title && f.value))

  console.log(blue('Card:', card.name))

  const description = String(card.description || '')
    .concat('\n\n')
    .concat(card.fields.map(f => f.name + ': ' + f.value).join('\n'))

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

  card.pullRequests.forEach((pull) => {
    const notes = []
    Object.entries(pull.$metadata).forEach(([key, value]) => {
      notes.push(coloredBoolean({ [key]: value }))
    })
    console.log(blue(`  - ${pull.url}`))
    console.log(blue(`    ${notes.join(' ')}`))
  })

  return card
}

async function mergeCardPrs (card, options) {
  console.log('----------------------------------')
  console.log('Merging prs')

  if (card.pullRequests.length === 0) {
    console.log(yellow('  No pull requests found'))
  }
  for (const pullRequest of card.pullRequests) {
    console.log(blue(`  - ${pullRequest.url}`))
    await githubFacade.rebasePullRequest({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      number: pullRequest.number
    }).catch(err => {
      console.log(yellow('    Rebase failed' + err.message))
    })

    if (!pullRequest.$metadata.publish) {
      console.log(yellow('    Skipped merge publish conditions not met'))
      continue
    }

    const reject = !options.continue
    const { state } = await $(`gh pr view ${pullRequest.url} --json state`, { stdio: 'pipe', loading: false, json: true })
    console.log(blue(`    State is ${state}`))

    const isOpen = state.includes('OPEN')
    if (isOpen) {
      const result = await $(`gh pr merge ${pullRequest.url} -d -r --admin`, { reject, stdio: 'pipe', loading: false, returnProperty: 'all' })

      if (!result.success) {
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

    const hasFluxCardComment = comments.some(comment => comment.body.includes('Flux: https://app.fluxcontrol.com.br/#/fluxo/b23ec9c8-8aeb-471a-8b2f-cd1af4f5e73e?view_mode=table&panel=card-detail&cardId='))

    if (!hasFluxCardComment) {
      await $(`gh pr comment ${pullRequest.url} --body Flux:\\ https://app.fluxcontrol.com.br/#/fluxo/b23ec9c8-8aeb-471a-8b2f-cd1af4f5e73e?view_mode=table&panel=card-detail&cardId=${card.id}`, { reject, stdio: 'ignore', loading: false })
      console.log(green('Added Flux comment to pull request'))
    }
  }
}

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
    console.log(red('  Skipped stage change.'))
    return
  }

  await fluxClient.moveCardToStage({
    cardId: card.id,
    afterStageId: STAGES.MERGED,
    beforeStageId: card.currentStage.id,
    nextCardId: null
  })

  console.log(green('  Card moved.'))
}
export default new PrMergeCommand()
