// @ts-check

import { unionBy, uniqBy } from 'lodash-es'
import { $ } from '../../core/exec.js'
import { fluxClient, STAGES } from '../../services/flux/flux-client.js'
import inquirer from 'inquirer'
import { githubFacade } from '../../core/githubFacade.js'

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
    console.log('Merging PR with flux...')

    const cards = await fluxClient.getUnopenedCards({
      stageId: STAGES.PUBLISH,
      take: 10,
      skip: 0
    })

    const cardsWithPrs = cards.items.map(extractPrData)

    const confirmed = options.confirm || await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `Found ${cardsWithPrs.length} cards with pull requests. Do you want to merge them?`,
      default: false
    }).then(answer => answer.confirm)

    if (!confirmed) {
      console.log('Merge operation not confirmed exiting.')
      return
    }

    console.log(`Found ${cardsWithPrs.length} cards with pull requests.`)
    for (const card of cardsWithPrs) {
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

function extractPrData (card) {
  console.log('Extracting PR data from card:', card.name.trim())
  card.name = card.name.trim()
  card.pullRequests = []
  const description = String(card.description || '')
  for (const match of description.matchAll(githubPrUrlRegex)) {
    if (match.groups == null) continue
    card.pullRequests.push({
      url: match[0],
      owner: match.groups.owner,
      repo: match.groups.repo,
      number: match.groups.number
    })
  }

  card.pullRequests = uniqBy(card.pullRequests, 'url')

  console.log(`   Found ${card.pullRequests.length} PR(s) in the card description.`)
  card.pullRequests.forEach(pr => {
    console.log(`      - ${pr.url}`)
  })

  return card
}

async function mergeCardPrs (card, options) {
  for (const pullRequest of card.pullRequests) {
    console.log('')
    console.log(`Merging pr ${pullRequest.url}`)

    const reject = !options.continue

    const prState = await $(`gh pr view ${pullRequest.url} --json state`, { reject, stdio: 'pipe', loading: false })
    console.log(`Pull request state: ${prState}`)

    const isOpen = prState.includes('OPEN')
    if (isOpen) {
      console.log(`Pull request ${pullRequest.url} is open merging...`)
      await $(`gh pr merge ${pullRequest.url} -d -r --admin`, { reject, stdio: 'inherit', loading: false })
      const job = await githubFacade.listWorkflowJobs({
        owner: pullRequest.owner,
        repo: pullRequest.repo
      })

      console.log(JSON.stringify(job, null, 2))

      await fluxClient.createCardComment({
        cardId: card.id,
        content: `Pull request ${pullRequest.url} merged successfully. ${job.html_url}`
      })

      await $(`gh pr comment ${pullRequest.url} --body Flux:\\ https://app.fluxcontrol.com.br/#/fluxo/b23ec9c8-8aeb-471a-8b2f-cd1af4f5e73e?view_mode=table&panel=card-detail&cardId=${card.id}`, { reject, stdio: 'inherit', loading: false })
    }

    console.log('pr merge request end')
  }
}

async function moveCardToMergedStage (card) {
  console.log(`Moving card "${card.name}" to the "Merged" stage...`)
  await fluxClient.moveCardToStage({
    cardId: card.id,
    afterStageId: STAGES.MERGED,
    beforeStageId: card.currentStage.id,
    nextCardId: null
  })
  console.log(`Card "${card.name}" moved to the "Merged" stage.`)
}
export default new PrMergeCommand()
