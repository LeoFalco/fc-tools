import { $ } from '../../core/exec.js'

class DeleteCommand {
  install ({ program }) {
    program
      .command('delete')
      .description('delete a branch or tag')
      .arguments('<branch_or_tag_name>', 'branch or tag to delete')
      .option('-r, --remote', 'also delete remote branch or tag')
      .action(this.action)
  }

  async action (branchOrTagName, { remote }) {
    await $('git checkout master')

    const options = {
      reject: false, returnProperty: 'exitCode'
    }

    const promises = [
      $(`git tag -d ${branchOrTagName}`, options).then((exitCode) => {
        if (exitCode === 0) {
          console.info('Deleted local tag')
        } else {
          console.info('No local tag deleted')
        }
      }),
      $(`git branch -D ${branchOrTagName}`, options).then((exitCode) => {
        if (exitCode === 0) {
          console.info('Deleted local branch')
        } else {
          console.info('No local branch deleted')
        }
      })
    ]

    if (remote) {
      promises.push(
        $(`git push origin :refs/tags/${branchOrTagName} --no-verify`, options).then((exitCode) => {
          if (exitCode === 0) {
            console.info('Deleted remote tag')
          } else {
            console.info('No remote tag deleted')
          }
        }),
        $(`git push origin :refs/heads/${branchOrTagName} --no-verify`, options).then((exitCode) => {
          if (exitCode === 0) {
            console.info('Deleted remote branch')
          } else {
            console.info('No remote branch deleted')
          }
        })
      )
    }

    await Promise.all(promises)

    await $('git remote prune origin')
  }
}

export default new DeleteCommand()
