// @ts-check

import { unionBy, uniqBy } from 'lodash-es'
import { $ } from '../../core/exec.js'
import { fluxClient } from '../../services/flux/flux-client.js'
import inquirer from 'inquirer'

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
      stageId: 'b50e2558-d96b-46aa-abee-a0425c553ef6',
      take: 10,
      skip: 0
    })

    console.log(`Found ${cards.items.length} unopened cards in the stage.`)

    const cardsWithPrs = cards.items.map(extractPrData)

    const confirmed = options.confirm || await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `Found ${cardsWithPrs.length} cards with pull requests. Do you want to merge them?`,
      default: false
    })

    for (const card of cardsWithPrs) {
      await mergeCardPrs(card)
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

async function mergeCardPrs (card) {
  for (const pullRequest of card.pullRequests) {
    console.log(`Merging PR: ${pullRequest.url}`)
    await $(`gh pr review ${pullRequest.url} --approve`, { reject: false, stdio: 'inherit', loading: false })
    await $(`gh pr merge ${pullRequest.url} -d -r --admin`, { reject: false, stdio: 'inherit', loading: false })
    console.log('PR merge request end')
  }
}
export default new PrMergeCommand()
