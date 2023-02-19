import { execaCommand as exec } from 'execa'
import { getCurrentSha, getLatestSha } from '../../core/check-update.js'

class UpdateCommand {
  install ({ program }) {
    program
      .command('update')
      .description('Self update this cli')
      .action(this.action)
  }

  async action () {
    console.log('INFO: Updating...')

    const currentSha = await getCurrentSha()
    const latestSha = await getLatestSha()

    console.log('currentSha', currentSha)
    console.log('latestSha', latestSha)

    if (currentSha === latestSha) {
      console.log('WARN: Already up to date.')
      return
    }

    await exec('git pull origin master', { stdio: 'inherit' })
    await exec('npm install', { stdio: 'inherit' })

    console.log('INFO: Update complete.')
  }
}

export default new UpdateCommand()
