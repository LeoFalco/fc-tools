import { execaCommand as exec } from 'execa'

class PushCommand {
  install ({ program }) {
    program
      .command('push')
      .description('Push the current branch to origin')
      .action(this.action)
  }

  async action () {
    const statusResult = await exec('git status --porcelain')
    if (statusResult.stdout) {
      console.error('ERROR: Repo is dirty, please commit or stash changes before running this script')
      process.exit(1)
    }

    const currentBranchResult = await exec('git rev-parse --abbrev-ref HEAD')
    const currentBranchName = currentBranchResult.stdout.trim()
    await exec(`git push origin ${currentBranchName} -u -f --no-verify`)
  }
}

export default new PushCommand()
