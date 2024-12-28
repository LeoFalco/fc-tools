// @ts-check

import { $ } from '../../core/exec.js'

class PrMergeCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('merge')
      .description('merge pull request')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   */
  async action (options) {
    const currentBranch = await $('git branch --show-current')
    await $('gh pr merge -d -r --admin')
    await $(`git branch -D ${currentBranch}`, { reject: false })
    await $('git remote prune origin')

    console.log('PR merged successfully')
  }
}

export default new PrMergeCommand()
