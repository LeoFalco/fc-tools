import { $ } from '../../core/exec.js'
import { info } from '../../core/patch-console-log.js'

class DependabotRebaseCommand {
  install ({ program }) {
    program
      .command('dependabot-rebase')
      .description('list all Dependabot and Renovate PRs, comment rebase on each, and enable auto-merge')
      .option('--merge', 'Merge the PRs', false)
      .action(this.action.bind(this))
  }

  async action (options) {
    const allPrs = await $('gh pr list --json number,author', { json: true })
    const prs = allPrs.filter(pr => {
      const author = pr.author.login.toLowerCase()
      return author.includes('dependabot') || author.includes('renovate')
    })

    if (!prs || prs.length === 0) {
      info('No open Dependabot or Renovate PRs found.')
      return
    }

    for (const pr of prs) {
      const { number, author } = pr
      info(`Processing PR #${number} by ${author.login}...`)

      const botName = author.login.toLowerCase().includes('dependabot') ? 'dependabot' : 'renovate'
      await $(`gh pr comment ${number} --body @${botName}\\ rebase`)

      if (options.merge) {
        await $(`gh pr merge ${number} --auto --squash`).catch((error) => {
          info(`Failed to merge PR #${number}.`, error.message)
        })
      }
    }

    info('Successfully processed all Dependabot PRs.')
  }
}

export default new DependabotRebaseCommand()
