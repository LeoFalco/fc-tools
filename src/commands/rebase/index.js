import { $ } from '../../core/exec.js'

class RebaseCommand {
  install ({ program }) {
    program
      .command('rebase')
      .description('rebase the current branch on top of the default branch')
      .option('-p, --push', 'force the rebase')
      .option('-f, --force', 'force the rebase')
      .action(this.action.bind(this))
  }

  async action (options) {
    const statusResult = await $('git status --porcelain')
    if (statusResult && statusResult.length) {
      console.error('Repo is dirty, please commit or stash changes before running this script')
      process.exit(1)
    }

    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')

    const defaultBranch = await $('git remote show origin').then(result => {
      const match = result.match(/HEAD branch: (.*)/)
      return match ? match[1] : 'master'
    })

    await $('git fetch')
    await $('git remote prune origin')
    await $(`git checkout ${defaultBranch}`)
    await $(`git pull origin ${defaultBranch}`)

    await $(`git checkout ${currentBranchName}`)
    await $(`git rebase ${defaultBranch}`)

    const isCurrentBranchAlreadyMerged = await $(`git branch --merged ${defaultBranch}`)
      .then((result) => {
        return result.split('\n')
          .map((branchName) => branchName.replace('*', ''))
          .map((branchName) => branchName.trim())
          .filter((branchName) => branchName !== defaultBranch)
          .some((branchName) => branchName === currentBranchName)
      })

    if (isCurrentBranchAlreadyMerged) {
      console.info('Current branch is already merged, deleting it')
      await $(`git checkout ${defaultBranch}`)
      await $(`git branch -D ${currentBranchName}`)
    }

    if (options.push && !isCurrentBranchAlreadyMerged && currentBranchName !== defaultBranch) {
      const authorEmail = await $('git config user.email')
      const branchAuthorEmail = await $(`git log -1 --pretty=format:"%ae" ${currentBranchName}`)

      if (authorEmail !== branchAuthorEmail) {
        if (options.force) {
          console.warn(`You are not the author of the branch ${currentBranchName}, but pushing anyway`)
        } else {
          console.error(`You are not the author of the branch ${currentBranchName}, skipping push, use --force to override`)
          process.exit(1)
        }
      }

      await $(`git push -u origin ${currentBranchName} --force --no-verify`)
    }
  }
}

export default new RebaseCommand()
