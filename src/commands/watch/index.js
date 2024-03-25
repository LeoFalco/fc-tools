import { $ } from '../../core/exec.js'
import open from 'open'

class PreviewCommand {
  install ({ program }) {
    program
      .command('watch')
      .description('watch ci in browser')
      .action(this.action.bind(this))
  }

  async action () {
    const currentCommitSha = await $('git rev-parse HEAD')

    const url = await $(`gh run list --commit ${currentCommitSha} --event push --json url --jq .[0].url`)

    await open(url, {
      wait: false
    })

    console.info(`Opening ${url} in browser`)
  }
}

export default new PreviewCommand()
