// @ts-check

import inquirer from 'inquirer'
import { $ } from '../../core/exec.js'
import { info } from '../../core/patch-console-log.js'

class RepoCleanCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('repo')
      .description('repo commands')
      .command('clean')
      .description('clean repo branches')
      .option('-b, --base-branch <branch>', 'specify the base branch')
      .action(this.action.bind(this))
  }

  async action (options) {
    const currentBranchName = await $('git rev-parse --abbrev-ref HEAD')
    await $('git fetch --all --prune')
    await $('git remote prune origin')

    const baseBranch = options.baseBranch || await $('git remote show origin').then(result => {
      const match = result.match(/HEAD branch: (.*)/)
      return match ? match[1] : 'master'
    })

    const workTrees = await listWorkTrees()
    const workTreeBranches = new Set(workTrees.map((w) => w.branch).filter(Boolean))
    const baseWorkTree = workTrees.find((w) => w.branch === baseBranch)
    const runningFromWorkTree = workTrees.some((w) => w.path === process.cwd() && !w.isMain)

    if (baseWorkTree) {
      await $(`git pull origin ${baseBranch}`, { cwd: baseWorkTree.path })
    } else {
      await $(`git checkout ${baseBranch}`)
      await $(`git pull origin ${baseBranch}`)
    }

    const branches = await $('git branch')
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.filter((branch) => branch.startsWith('*') === false))
      .then((branches) => branches.filter((branch) => branch.startsWith('+') === false))
      .then((branches) => branches.filter((branch) => !workTreeBranches.has(branch)))
      .then((branches) => branches.filter((branch) => branch !== baseBranch))
      .then((branches) => branches.filter((branch) => !branch.startsWith(baseBranch)))
      .then((branches) => branches.filter((branch) => branch !== 'homolog'))
      .then((branches) => branches.filter((branch) => branch !== 'wiki/master'))

    for (const branch of branches) {
      const isAhead = await $(`git log ${baseBranch}..${branch} --oneline`).then((output) => output !== '')
      if (isAhead) {
        await $(`git checkout ${branch}`)
        await $(`git rebase ${baseBranch}`)
        await $(`git push origin ${branch} --force --no-verify`)
      } else {
        info(`Branch ${branch} is not ahead of ${baseBranch}`)
      }
    }

    if (!runningFromWorkTree) {
      await $(`git checkout ${baseBranch}`)
    }

    const removableWorkTrees = workTrees.filter((w) => !w.isMain && w.path !== process.cwd())
    for (const workTree of removableWorkTrees) {
      info(`Removing worktree ${workTree.path}${workTree.branch ? ` (${workTree.branch})` : ''}`)
      await $(`git worktree remove ${workTree.path}`)
      if (workTree.branch) workTreeBranches.delete(workTree.branch)
    }

    const mergedBranches = await $(`git branch --merged ${baseBranch}`)
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.map((branch) => branch.replace('origin/', '')))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.filter((branch) => branch.startsWith('*') === false))
      .then((branches) => branches.filter((branch) => branch.startsWith('+') === false))
      .then((branches) => branches.filter((branch) => !workTreeBranches.has(branch)))
      .then((branches) => branches.filter((branch) => branch !== baseBranch))
      .then((branches) => branches.filter((branch) => branch !== 'preview'))
      .then((branches) => branches.filter((branch) => branch !== 'homolog'))
      .then((branches) => branches.filter((branch) => branch.startsWith('master') === false))
      .then((branches) => branches.filter((branch) => branch !== 'wiki/master'))

    if (mergedBranches.length === 0) {
      info('No local branches to delete')
    } else {
      for (const branch of mergedBranches) {
        info(`Deleting local branch ${branch}`)
        await $(`git branch -D ${branch}`)
      }
    }

    if (!mergedBranches.includes(currentBranchName)) {
      await $(`git checkout ${currentBranchName}`)
    }

    const mergedOnRemoteBranches = await $(`git branch -r --merged origin/${baseBranch}`)
      .then((output) => output.split('\n'))
      .then((branches) => branches.map((branch) => branch.trim()))
      .then((branches) => branches.filter((branch) => branch !== ''))
      .then((branches) => branches.map((branch) => branch.replace('origin/', '')))
      .then((branches) => branches.filter((branch) => branch.startsWith('HEAD') === false))
      .then((branches) => branches.filter((branch) => branch !== baseBranch))
      .then((branches) => branches.filter((branch) => branch !== 'preview'))
      .then((branches) => branches.filter((branch) => branch !== 'homolog'))
      .then((branches) => branches.filter((branch) => branch.startsWith('master') === false))
      .then((branches) => branches.filter((branch) => branch !== 'wiki/master'))

    if (mergedOnRemoteBranches.length === 0) {
      info('No remote branches to delete')
    } else {
      const { remoteBranchesToDelete } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'remoteBranchesToDelete',
        message: 'Select remote branches to delete',
        choices: mergedOnRemoteBranches
      }])

      for (const branch of remoteBranchesToDelete) {
        info(`Deleting remote branch ${branch}`)
        await $(`git push origin --delete ${branch} --no-verify`)
      }
    }
  }
}

async function listWorkTrees () {
  const output = await $('git worktree list --porcelain', { disableLog: true, loading: false })
  if (typeof output !== 'string' || output === '') return []

  const workTrees = []
  let current = {}
  for (const line of output.split('\n')) {
    if (line === '') {
      if (current.path) workTrees.push(current)
      current = {}
      continue
    }
    const [key, ...rest] = line.split(' ')
    const value = rest.join(' ')
    if (key === 'worktree') current.path = value
    else if (key === 'branch') current.branch = value.replace('refs/heads/', '')
  }
  if (current.path) workTrees.push(current)

  if (workTrees.length > 0) workTrees[0].isMain = true
  return workTrees
}

export default new RepoCleanCommand()
