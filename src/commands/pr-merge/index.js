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
      .command('pr-merge')
      .description('merge pull request')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   */
  async action (options) {
    await $('gh pr merge -d -r --admin', {
      stdio: 'inherit'
    })

    console.log('PR merged successfully')
  }
}

export default new PrMergeCommand()
