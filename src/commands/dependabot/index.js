import { mergeAction } from './merge.js'
import { rebaseAction } from './rebase.js'

class DependabotCommand {
  install ({ program }) {
    const dependabot = program
      .command('dependabot')
      .description('manage Dependabot and Renovate PRs')

    dependabot
      .command('merge')
      .description('scan Dependabot PRs, assess risk, approve and merge')
      .option('--all', 'scan all org repos instead of current repo only', false)
      .action(mergeAction)

    dependabot
      .command('rebase')
      .description('comment rebase on Dependabot/Renovate PRs and optionally enable auto-merge')
      .option('--merge', 'enable auto-merge on the PRs', false)
      .action(rebaseAction)
  }
}

export default new DependabotCommand()
