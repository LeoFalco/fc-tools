import { $ } from '../../core/exec.js'

class PreviewCommand {
  install ({ program }) {
    program
      .command('homolog')
      .description('push current branch to preview environment')
      .arguments('[preview_branch_name]', 'Branch or tag to delete, defaults to homolog')
      .action(this.action.bind(this))
  }

  async action (previewBranchName) {
    previewBranchName = previewBranchName || 'homolog'
    const previewTagExitCode = await $(`git rev-parse --verify ${previewBranchName}`, { returnProperty: 'exitCode', reject: false })
    if (previewTagExitCode === 0) {
      await $(`git tag -d ${previewBranchName}`, { reject: false })
    }

    await $(`git push origin HEAD:refs/heads/${previewBranchName} -f --no-verify`)
    console.info(`branch "${previewBranchName}" pushed`)
  }
}

export default new PreviewCommand()
