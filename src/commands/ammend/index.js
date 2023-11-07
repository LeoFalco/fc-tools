import { $ } from '../../core/exec.js'

class RebaseCommand {
  install ({ program }) {
    program
      .command('ammend')
      .description('git ammend and push')
      .action(this.action.bind(this))
  }

  async action () {
    await $('git commit --amend --no-verify --no-edit')
    await $('git push -f --no-verify')
  }
}

export default new RebaseCommand()
