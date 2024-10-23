// @ts-check

import inquirer from 'inquirer'
import { $ } from '../../core/exec.js'
import { info } from '../../core/patch-console-log.js'

class RepoCleanCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('repo')
      .description('repo commands')
      .command('clean')
      .description('clean repo branches')
      .option('-b, --base-branch <branch>', 'specify the base branch')
      .action(this.action.bind(this))
  }

  async action (options) {
    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')
    await $('git fetch --all --prune')
    await $('git remote prune origin')

    const baseBranch = options.baseBranch || await $('git remote show origin').then(result => {
      const match = result.match(/HEAD branch: (.*)/)
      return match ? match[1] : 'master'
    })

    await $(`git checkout ${baseBranch}`)
    await $(`git pull origin ${baseBranch}`)

    const branches = await $('git branch')
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.filter((branch) => branch.startsWith('*') === false))
      .then((branches) => branches.filter((branch) => branch !== baseBranch))
      .then((branches) => branches.filter((branch) => !branch.startsWith(baseBranch)))
      .then((branches) => branches.filter((branch) => branch !== 'homolog'))

    for (const branch of branches) {
      const isAhead = await $(`git log ${baseBranch}..${branch} --oneline`).then((output) => output !== '')
      if (isAhead) {
        await $(`git checkout ${branch}`)
        await $(`git rebase ${baseBranch}`)
        await $(`git push origin ${branch} --force --no-verify`)
      } else {
        info(`Branch ${branch} is not ahead of ${baseBranch}`)
      }
    }

    const mergedBranches = await $(`git branch --merged ${baseBranch}`)
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.map((branch) => branch.replace('origin/', '')))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.filter((branch) => branch.startsWith('*') === false))
      .then((branches) => branches.filter((branch) => branch !== baseBranch))
      .then((branches) => branches.filter((branch) => branch !== 'preview'))
      .then((branches) => branches.filter((branch) => branch !== 'homolog'))
      .then((branches) => branches.filter((branch) => branch.startsWith('master') === false))

    if (mergedBranches.length === 0) {
      info('No local branches to delete')
    } else {
      for (const branch of mergedBranches) {
        info(`Deleting local branch ${branch}`)
        await $(`git branch -D ${branch}`)
      }
    }

    if (!mergedBranches.includes(currentBranchName)) {
      await $(`git checkout ${currentBranchName}`)
    }

    const mergedOnRemoteBranches = await $(`git branch -r --merged origin/${baseBranch}`)
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.map((branch) => branch.replace('origin/', '')))
      .then((branches) => branches.filter((branch) => branch.startsWith('HEAD') === false))
      .then((branches) => branches.filter((branch) => branch !== baseBranch))
      .then((branches) => branches.filter((branch) => branch !== 'preview'))
      .then((branches) => branches.filter((branch) => branch !== 'homolog'))
      .then((branches) => branches.filter((branch) => branch.startsWith('master') === false))

    if (mergedOnRemoteBranches.length === 0) {
      info('No remote branches to delete')
    } else {
      const { remoteBranchesToDelete } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'remoteBranchesToDelete',
        message: 'Select remote branches to delete',
        choices: mergedOnRemoteBranches
      }])

      for (const branch of remoteBranchesToDelete) {
        info(`Deleting remote branch ${branch}`)
        await $(`git push origin --delete ${branch} --no-verify`)
      }
    }
  }
}

export default new RepoCleanCommand()
