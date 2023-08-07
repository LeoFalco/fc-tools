// @ts-check

import inquirer from 'inquirer'
import { $ } from '../../core/exec.js'

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
      .action(this.action.bind(this))
  }

  async action () {
    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')
    await $('git fetch --all --prune')
    await $('git remote prune origin')

    await $('git checkout master')

    const mergedBranches = await $('git branch --merged master')
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.filter((branch) => branch.startsWith('*') === false))

    if (mergedBranches.length === 0) {
      console.log('No local branches to delete')
    } else {
      for (const branch of mergedBranches) {
        console.log(`Deleting local branch ${branch}`)
        await $(`git branch -D ${branch}`)
      }
    }

    if (!mergedBranches.includes(currentBranchName)) {
      await $(`git checkout ${currentBranchName}`)
    }

    const mergedOnRemoteBranches = await $('git branch -r --merged origin/master')
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.map((branch) => branch.replace('origin/', '')))
      .then((branches) => branches.filter((branch) => branch.endsWith('master') === false))

    if (mergedOnRemoteBranches.length === 0) {
      console.log('No remote branches to delete')
    } else {
      const { remoteBranchesToDelete } = await inquirer.prompt([
        {

          type: 'checkbox',
          name: 'remoteBranchesToDelete',
          message: 'Select remote branches to delete',
          choices: mergedOnRemoteBranches
        }
      ])

      for (const branch of remoteBranchesToDelete) {
        console.log(`Deleting remote branch ${branch}`)
        await $(`git push origin --delete ${branch} --no-verify`)
      }
    }
  }
}

export default new RepoCleanCommand()
