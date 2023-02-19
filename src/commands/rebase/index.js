import { execaCommand as exec } from 'execa'

class RebaseCommand {
  install ({ program }) {
    program
      .command('rebase')
      .description('Rebase the current branch on top of the master branch')
      .action(this.action)
  }

  async action () {
    const statusResult = await exec('git status --porcelain')
    if (statusResult.stdout) {
      console.error('ERROR: Repo is dirty, please commit or stash changes before running this script')
      process.exit(1)
    }

    await exec('git fetch --tags --force')
    await exec('git remote prune origin')

    const currentBranchResult = await exec('git rev-parse --abbrev-ref HEAD')
    const currentBranchName = currentBranchResult.stdout

    await exec('git checkout master')
    await exec('git pull origin master')

    await exec(`git checkout ${currentBranchName}`)
    await exec('git rebase master')

    await exec('git checkout master')

    const isCurrentBranchAlreadyMerged = await exec('git branch --merged')
      .then((result) => {
        return result.stdout.split('\n')
          .map((branchName) => branchName.trim())
          .map((branchName) => branchName.replace('*', ''))
          .filter((branchName) => branchName !== 'master')
          .some((branchName) => branchName === currentBranchName)
      })

    if (isCurrentBranchAlreadyMerged) {
      await exec(`git branch -D ${currentBranchName}`)
    }
  }
}

export default new RebaseCommand()
