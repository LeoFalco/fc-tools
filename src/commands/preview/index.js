import { $ } from '../../core/exec.js'

class PreviewCommand {
  install ({ program }) {
    program
      .command('preview')
      .description('push current branch to preview environment')
      .arguments('[preview_branch_name]', 'Branch or tag to delete, defaults to preview')
      .action(this.action.bind(this))
  }

  async action (previewBranchName) {
    previewBranchName = previewBranchName || 'preview'
    await $(`git push origin HEAD:refs/heads/${previewBranchName} -f --no-verify`)
    console.info(`branch "${previewBranchName}" pushed to preview environment`)

    const previewTagExitCode = await $(`git rev-parse --verify ${previewBranchName}`, { returnProperty: 'exitCode' })
    if (previewTagExitCode === 0) {
      await $(`git tag -d ${previewBranchName}`)
    }
  }
}

export default new PreviewCommand()
