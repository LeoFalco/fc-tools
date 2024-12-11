import { $ } from '../../core/exec.js'
import { info } from '../../core/patch-console-log.js'

class PreviewCommand {
  install ({ program }) {
    program
      .command('homolog')
      .description('push current branch to homolog environment')
      .action(this.action.bind(this))
  }

  async action () {
    const currentBranch = await $('git rev-parse --abbrev-ref HEAD').then(result => result.trim())
    const defaultBranch = await $('git remote show origin').then(result => {
      const match = result.match(/HEAD branch: (.*)/)
      return match ? match[1] : 'master'
    })

    // checkout default branch
    await $(`git checkout ${defaultBranch}`)

    // update default branch
    await $(`git pull origin ${defaultBranch}`)

    // delete local homolog branch
    await $('git branch -D homolog')

    const homologBranchExistsOnRemote = await $('git ls-remote --heads origin homolog', { returnProperty: 'exitCode', reject: false }).then(result => result === 0)

    if (homologBranchExistsOnRemote) {
      await $('git fetch origin homolog:homolog')
      await $('git checkout homolog')
    } else {
      await $('git checkout -b homolog')
    }

    // rebase homolog branch on top of default branch
    await $(`git rebase ${defaultBranch}`)

    // rebase current branch on top of homolog branch
    await $(`git checkout ${currentBranch}`)
    await $('git rebase homolog')

    // push homolog branch to remote
    await $('git push origin homolog -f')
  }
}

export default new PreviewCommand()
