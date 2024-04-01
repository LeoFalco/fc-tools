import { $ } from '../../core/exec.js'

class RebaseCommand {
  install ({ program }) {
    program
      .command('continue')
      .description('continue rebase')
      .action(this.action.bind(this))
  }

  async action () {
    await $('git add -A')
    await $('git rebase --continue --no-edit')
  }
}

export default new RebaseCommand()
