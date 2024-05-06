import { sleep } from 'openai/core.js'
import { $ } from '../../core/exec.js'
import open from 'open'
import { info, warn } from '../../core/patch-console-log.js'

class PreviewCommand {
  install ({ program }) {
    program
      .command('watch')
      .description('watch ci in browser')
      .action(this.action.bind(this))
      .option('-w --web', 'open in browser')
  }

  async action (options) {
    const currentCommitSha = await $('git rev-parse HEAD')

    const { databaseId, url, name } = await this.fetchRunInfo(currentCommitSha)

    if (options.web) {
      info(`Opening ${url} in browser`)
      await open(url)
    } else {
      info(`Watching run ${name}`)
      await $(`gh run watch ${databaseId} -i 1 --exit-status`, { stdio: 'inherit' })
      await $('notify-send Run finished')
    }
  }

  async fetchRunInfo (currentCommitSha, retries = 0) {
    await sleep(1000)
    const data = await $(`gh run list --commit ${currentCommitSha} --event push --json databaseId,url,name`)
      .then(JSON.parse)

    if (data && data.length) {
      return data[0]
    }

    if (retries > 3) {
      throw new Error('Failed to get url after 3 retries')
    }

    warn(`Failed to get url, retrying ${retries + 1}`)

    return this.fetchRunInfo(currentCommitSha, retries + 1)
  }
}

export default new PreviewCommand()
