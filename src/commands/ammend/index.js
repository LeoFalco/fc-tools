import { $ } from '../../core/exec.js'

class RebaseCommand {
  install ({ program }) {
    program
      .command('amend')
      .description('git amend and push')
      .action(this.action.bind(this))
  }

  async action () {
    await $('git add -A')
    await $('git commit --amend --no-verify --no-edit')
    const currentBranch = await $('git rev-parse --abbrev-ref HEAD')
    await $(`git push -f --no-verify --set-upstream origin ${currentBranch}`)
  }
}

export default new RebaseCommand()
