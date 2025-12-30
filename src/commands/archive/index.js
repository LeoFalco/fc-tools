// @ts-check

import chalk from 'chalk'
import inquirer from 'inquirer'
import { fluxClient, STAGES } from '../../services/flux/flux-client.js'
const { green, gray, blue } = chalk

class ArchiveCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('archive')
      .description('archive flux cards')
      .option('--confirm', 'execute archive without confirmation')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   * @param {boolean} options.confirm
   */
  async action (options) {
    await this.actionWithFlux(options)
  }

  /**
   * @param {Object} options
   * @param {boolean} options.confirm
   */
  async actionWithFlux (options) {
    console.log(blue('Using flux find pull requests'))

    const cards = await fluxClient.getUnopenedCards({
      stageId: STAGES.LIVE,
      take: 100,
      skip: 0
    })

    if (!cards || cards.length === 0) {
      console.log(gray('No cards found in live stage'))
      return
    }

    for (const card of cards) {
      console.log(gray(`  - ${card.name}`))
    }

    const confirmed = options.confirm || await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `Found ${cards.length} cards. Do you want to archive them?`,
      default: false
    }).then(answer => answer.confirm)

    if (!confirmed) {
      console.log('Merge operation not confirmed exiting.')
      return
    }

    for (const card of cards) {
      await archiveCard(card)
    }

    console.log(green('All done!'))
  }
}

/**
 * @param {{ id: string; name: string}} card
 */
async function archiveCard (card) {
  await fluxClient.archiveCard({
    cardId: card.id
  })

  console.log('-', card.name, green('  Card archived'))
}
export default new ArchiveCommand()
