import { sleep } from 'openai/core.js'
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

    const url = await this.getUrl(currentCommitSha)

    await open(url, {
      wait: false
    })

    console.info(`Opening ${url} in browser`)
  }

  async getUrl (currentCommitSha, retries = 0) {
    const url = await $(`gh run list --commit ${currentCommitSha} --event push --json url --jq .[0].url`)

    if (url) {
      return url
    }

    if (retries > 3) {
      throw new Error('Failed to get url after 3 retries')
    }

    console.warn(`Failed to get url, retrying ${retries + 1}`)
    await sleep(3000)

    return this.getUrl(currentCommitSha, retries + 1)
  }
}

export default new PreviewCommand()
