import { $ } from '../../core/exec.js'

class DeleteCommand {
  install ({ program }) {
    program
      .command('delete')
      .description('delete a branch or tag')
      .arguments('<branch_or_tag_name>', 'Branch or tag to delete')
      .action(this.action)
  }

  async action (branchOrTagName) {
    await $('git checkout master')

    const options = {
      reject: false, returnProperty: 'exitCode'
    }

    const {
      0: deleteTagResult,
      1: deleteBranchResult,
      2: deleteRemoteTagResult,
      3: deleteRemoteBranchResult
    } = await Promise.all([
      $(`git tag -d ${branchOrTagName}`, options),
      $(`git branch -D ${branchOrTagName}`, options),
      $(`git push origin :refs/tags/${branchOrTagName} --no-verify`, options),
      $(`git push origin :refs/heads/${branchOrTagName} --no-verify`, options)
    ])

    if (deleteTagResult === 0) {
      console.info(`Deleted tag \`${branchOrTagName}\``)
    }
    if (deleteBranchResult === 0) {
      console.info(`Deleted branch \`${branchOrTagName}\``)
    }
    if (deleteRemoteTagResult === 0) {
      console.info(`Deleted remote tag \`${branchOrTagName}\``)
    }
    if (deleteRemoteBranchResult === 0) {
      console.info(`Deleted remote branch \`${branchOrTagName}\``)
    }

    await $('git remote prune origin')
  }
}

export default new DeleteCommand()
