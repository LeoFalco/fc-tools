import { $ } from '../../core/exec.js'

function isZero (exitCode) {
  return exitCode === 0
}

class DeleteCommand {
  install ({ program }) {
    program
      .command('delete')
      .description('delete a branch or tag')
      .arguments('<branch_or_tag_name>', 'branch or tag to delete')
      .option('-r, --remote', 'also delete remote branch or tag')
      .action(this.action.bind(this))
  }

  async action (branchOrTagName, { remote }) {
    if (branchOrTagName.startsWith('origin/')) {
      branchOrTagName = branchOrTagName.replace('origin/', '')
    }
    await $('git checkout master')

    const [hasLocalBranch, hasTag, hasRemoteBranch, hasRemoteTag] = await Promise.all([
      this.localBranchExists(branchOrTagName),
      this.localTagExists(branchOrTagName),
      this.remoteBranchExists(branchOrTagName),
      this.remoteTagExists(branchOrTagName)
    ])

    const promises = []

    if (hasLocalBranch) {
      promises.push(this.deleteLocalBranch(branchOrTagName))
    } else {
      console.info('Local branch does not exist')
    }

    if (hasTag) {
      promises.push(this.deleteLocalTag(branchOrTagName))
    } else {
      console.info('Local tag does not exist')
    }

    if (hasRemoteBranch && !remote) {
      console.info('Remote branch exists, but not deleting because --remote flag was not set')
    }

    if (hasRemoteTag && !remote) {
      console.info('Remote tag exists, but not deleting because --remote flag was not set')
    }

    if (!hasRemoteBranch && remote) {
      console.info('Remote branch does not exist')
    }

    if (!hasRemoteTag && remote) {
      console.info('Remote tag does not exist')
    }

    if (hasRemoteBranch && remote) {
      promises.push(this.deleteRemoteBranch(branchOrTagName))
    }

    if (hasRemoteTag && remote) {
      promises.push(this.deleteRemoteTag(branchOrTagName))
    }

    await Promise.all(promises)

    await $('git remote prune origin')
  }

  async deleteLocalTag (branchOrTagName) {
    await $(`git tag -d ${branchOrTagName}`)
    console.info('Deleted local tag')
  }

  async deleteLocalBranch (branchOrTagName) {
    await $(`git branch -D ${branchOrTagName}`)
    console.info('Deleted local branch')
  }

  async deleteRemoteBranch (branchOrTagName) {
    await $(`git push origin :refs/heads/${branchOrTagName} --no-verify`)
    console.info('Deleted remote branch')
  }

  async deleteRemoteTag (branchOrTagName) {
    await $(`git push origin :refs/tags/${branchOrTagName} --no-verify`)
    console.info('Deleted remote tag')
  }

  async localBranchExists (branchOrTagName) {
    const result = await $(`git rev-parse --verify ${branchOrTagName}`, { reject: false, returnProperty: 'exitCode' })
    return isZero(result)
  }

  async localTagExists (branchOrTagName) {
    const result = await $(`git rev-parse --verify refs/tags/${branchOrTagName}`, { reject: false, returnProperty: 'exitCode' })
    return isZero(result)
  }

  async remoteBranchExists (branchOrTagName) {
    const result = await $(`git rev-parse --verify origin/${branchOrTagName}`, { reject: false, returnProperty: 'exitCode' })
    return isZero(result)
  }

  async remoteTagExists (branchOrTagName) {
    const result = await $(`git rev-parse --verify refs/tags/origin/${branchOrTagName}`, { reject: false, returnProperty: 'exitCode' })
    return isZero(result)
  }
}

export default new DeleteCommand()
