import { $ } from '../../core/exec.js'
import { error, info } from '../../core/patch-console-log.js'

class PushCommand {
  install ({ program }) {
    program
      .command('push')
      .description('push the current branch to origin')
      .action(this.action.bind(this))
  }

  async action () {
    const statusResult = await $('git status --porcelain')
    if (statusResult && statusResult.length) {
      error('Repo is dirty, please commit or stash changes before running this script')
      process.exit(1)
    }

    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')
    await $(`git push origin ${currentBranchName} -u -f --no-verify`)
    info(`pushed branch ${currentBranchName}`)
  }
}

export default new PushCommand()
