import { $ } from '../../core/exec.js'
import chalk from 'chalk'
const { cyan } = chalk
class RebaseCommand {
  install ({ program }) {
    program
      .command('version')
      .description('show detail info of the current version of the CLI')
      .action(this.action.bind(this))
  }

  async action () {
    const gitDir = `${process.env.HOME}/.fc-tools/.git`
    const workTree = `${process.env.HOME}/.fc-tools`
    const format = '%H%n%an%n%ad%n%s' // hash \n author \n date \n message

    const lastCommit = await $(`git --git-dir ${gitDir} --work-tree ${workTree} log -n 1 --format=${format} --date=iso`)

    const [hash, author, date, message] = lastCommit.split('\n')

    console.info(`${cyan('Author')} : ${author}`)
    console.info(`${cyan('Date')}   : ${date}`)
    console.info(`${cyan('Hash')}   : ${hash}`)
    console.info(`${cyan('Message')}: ${message}`)
  }
}

export default new RebaseCommand()
