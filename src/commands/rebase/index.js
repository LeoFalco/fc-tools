import { $ } from '../../core/exec.js'

class RebaseCommand {
  install ({ program }) {
    program
      .command('rebase')
      .description('Rebase the current branch on top of the master branch')
      .action(this.action)
  }

  async action () {
    const statusResult = await $('git status --porcelain')
    if (statusResult && statusResult.length) {
      console.error('ERROR: Repo is dirty, please commit or stash changes before running this script')
      process.exit(1)
    }

    await $('git fetch --tags --force')
    await $('git remote prune origin')
    await $('git checkout master')
    await $('git pull origin master')

    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')

    await $(`git checkout ${currentBranchName}`)
    await $('git rebase master')

    const isCurrentBranchAlreadyMerged = await $('git branch --merged')
      .then((result) => {
        return result.stdout.split('\n')
          .map((branchName) => branchName.trim())
          .map((branchName) => branchName.replace('*', ''))
          .filter((branchName) => branchName !== 'master')
          .some((branchName) => branchName === currentBranchName)
      })

    if (isCurrentBranchAlreadyMerged) {
      console.log('INFO: Current branch is already merged, deleting it')
      await $('git checkout master')
      await $(`git branch -D ${currentBranchName}`)
    }
  }
}

export default new RebaseCommand()
