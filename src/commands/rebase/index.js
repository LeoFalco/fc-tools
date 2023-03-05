import { $ } from '../../core/exec.js'

class RebaseCommand {
  install ({ program }) {
    program
      .command('rebase')
      .description('rebase the current branch on top of the master branch')
      .option('-p, --push', 'force the rebase')
      .action(this.action)
  }

  async action (options) {
    const statusResult = await $('git status --porcelain')
    if (statusResult && statusResult.length) {
      console.error('Repo is dirty, please commit or stash changes before running this script')
      process.exit(1)
    }

    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')

    await $('git fetch')
    await $('git remote prune origin')
    await $('git checkout master')
    await $('git pull origin master')

    await $(`git checkout ${currentBranchName}`)
    await $('git rebase master')

    const isCurrentBranchAlreadyMerged = await $('git branch --merged master')
      .then((result) => {
        return result.split('\n')
          .map((branchName) => branchName.replace('*', ''))
          .map((branchName) => branchName.trim())
          .filter((branchName) => branchName !== 'master')
          .some((branchName) => branchName === currentBranchName)
      })

    if (isCurrentBranchAlreadyMerged) {
      console.info('Current branch is already merged, deleting it')
      await $('git checkout master')
      await $(`git branch -D ${currentBranchName}`)
    }

    if (options.push && !isCurrentBranchAlreadyMerged && currentBranchName !== 'master') {
      await $(`git push -u origin ${currentBranchName} --force --no-verify`)
    }
  }
}

export default new RebaseCommand()
