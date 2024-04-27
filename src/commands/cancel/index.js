import { sleep } from 'openai/core.js'
import { $ } from '../../core/exec.js'
import { warn } from '../../core/patch-console-log.js'

class PreviewCommand {
  install ({ program }) {
    program
      .command('cancel')
      .description('cancel ci run')
      .action(this.action.bind(this))
  }

  async action () {
    const currentCommitSha = await $('git rev-parse HEAD')

    const id = await this.getId(currentCommitSha)

    await $(`gh run cancel ${id}`)
  }

  async getId (currentCommitSha, retries = 0) {
    const url = await $(`gh run list --commit ${currentCommitSha} --event push --json databaseId --jq .[0].databaseId`)

    if (url) {
      return url
    }

    if (retries > 3) {
      throw new Error('Failed to get url after 3 retries')
    }

    warn(`Failed to get url, retrying ${retries + 1}`)
    await sleep(3000)

    return this.getId(currentCommitSha, retries + 1)
  }
}

export default new PreviewCommand()
