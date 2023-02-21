import { execaCommand as exec } from 'execa'
import { $ } from '../../core/exec.js'

class PushCommand {
  install ({ program }) {
    program
      .command('push')
      .description('Push the current branch to origin')
      .action(this.action)
  }

  async action () {
    const statusResult = await $('git status --porcelain')
    if (statusResult && statusResult.length) {
      console.error('ERROR: Repo is dirty, please commit or stash changes before running this script')
      process.exit(1)
    }

    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')
    await exec(`git push origin ${currentBranchName} -u -f --no-verify`)
  }
}

export default new PushCommand()
