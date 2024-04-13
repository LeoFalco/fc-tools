import { $ } from '../../core/exec.js'
import { error, info, warn } from '../../core/patch-console-log.js'

class DoctorCommand {
  install ({ program }) {
    program
      .command('doctor')
      .description('Check if all required tools are installed')
      .action(this.action.bind(this))
  }

  async action () {
    const errors = []
    const success = []

    try {
      const gitStdout = await $('git --version')
      success.push({
        message: `git is successfully installed, found version: ${gitStdout.split(' ')[2]}`
      })
    } catch (err) {
      errors.push({
        message: 'git is not installed, please install it from https://git-scm.com/downloads'
      })
    }

    try {
      const ghStdout = await $('gh --version')
      success.push({
        message: `gh is successfully installed, found version: ${ghStdout.split(' ')[2]}`
      })
    } catch (err) {
      errors.push({
        message: 'gh is not installed, please install it from https://cli.github.com'
      })
    }

    if (success.length) {
      success.forEach((success) => {
        info(success.message)
      })
    }

    if (errors.length) {
      errors.forEach((error) => {
        warn(error.message)
      })
    }

    if (errors.length) {
      error('Some tools are not installed, please install them')
      process.exit(1)
    } else {
      info('All tools are installed')
    }
  }
}

export default new DoctorCommand()
