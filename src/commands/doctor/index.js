import { execaCommand as exec } from 'execa'

class DoctorCommand {
  install ({ program }) {
    program
      .command('doctor')
      .description('check if all required tools are installed')
      .action(this.action)
  }

  async action () {
    const errors = []
    const success = []
    try {
      const git = await exec('git --version')
      success.push({
        message: `git is successfully installed, found version: ${git.stdout.split(' ')[2]}`
      })
    } catch (err) {
      errors.push({
        message: 'git is not installed, please install it from https://git-scm.com/downloads'
      })
    }

    try {
      const gh = await exec('gh --version')
      success.push({
        message: `gh is successfully installed, found version: ${gh.stdout.split(' ')[2]}`
      })
    } catch (err) {
      errors.push({
        message: 'gh is not installed, please install it from https://cli.github.com'
      })
    }

    if (success.length) {
      console.log('Installed tools:')
      success.forEach((success) => {
        console.log(success.message)
      })
    }

    if (errors.length) {
      console.error('Missing tools:')
      errors.forEach((error) => {
        console.error(error.message)
      })
    }

    if(!errors.length) {
      console.log('All tools are installed')
    }
  }
}

export default new DoctorCommand()
