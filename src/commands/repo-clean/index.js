// @ts-check

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $ } from '../../core/exec.js'
import inquirer from 'inquirer'

const CURRENT_DIR_NAME = dirname(fileURLToPath(import.meta.url))
const PR_DESCRIPTION_FILE_PATH = join(CURRENT_DIR_NAME, '../../../data/pr-description.txt')
const PR_DESCRIPTION_FOLDER_PATH = dirname(PR_DESCRIPTION_FILE_PATH)

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

  /**
   * @param {Object} options
   */
  async action (options) {
    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')
    await $('git fetch --all --prune')
    await $('git remote prune origin')

    await $('git checkout master')

    const mergedBranches = await $('git branch --merged master')
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.filter((branch) => branch.startsWith('*') === false))

    for (const branch of mergedBranches) {
      await $(`git branch -D ${branch}`)
    }

    if (mergedBranches.includes(currentBranchName)) {
      await $(`git checkout ${currentBranchName}`)
    }

    const mergedOnRemoteBranches = await $('git branch -r --merged origin/master')
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.map((branch) => branch.replace('origin/', '')))
      .then((branches) => branches.filter((branch) => branch.endsWith('master') === false))

    const { remoteBranchesToDelete } = await inquirer.prompt([
      {

        type: 'checkbox',
        name: 'remoteBranchesToDelete',
        message: 'Select remote branches to delete',
        choices: mergedOnRemoteBranches
      }
    ])

    for (const branch of remoteBranchesToDelete) {
      await $(`git push origin --delete ${branch}`)
    }
  }
}

export default new RepoCleanCommand()
