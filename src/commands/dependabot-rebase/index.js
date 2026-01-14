import { $ } from '../../core/exec.js'
import { info } from '../../core/patch-console-log.js'

class DependabotRebaseCommand {
  install ({ program }) {
    program
      .command('dependabot-rebase')
      .description('list all dependabot prs and comment @dependabot rebase on each, enabling auto-merge')
      .action(this.action.bind(this))
  }

  async action () {
    const prs = await $('gh pr list --author "app/dependabot" --json number', { json: true })

    if (!prs || prs.length === 0) {
      info('No open Dependabot PRs found.')
      return
    }

    for (const pr of prs) {
      const { number } = pr
      info(`Processing PR #${number}...`)
      await $(`gh pr comment ${number} --body "@dependabot rebase"`)
      await $(`gh pr merge ${number} --auto --rebase`)
    }

    info('Successfully processed all Dependabot PRs.')
  }
}

export default new DependabotRebaseCommand()
