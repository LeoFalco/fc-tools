// @ts-check

import chalk from 'chalk'
import chalkTable from 'chalk-table'
import { $ } from '../../core/exec.js'

const ORG = 'FieldControl'

class ReposCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('repos')
      .description('list fieldcontrol repositories you can merge into')
      .action(this.action.bind(this))
  }

  async action () {
    const repos = await $('gh api --paginate /user/repos?affiliation=organization_member', {
      json: true,
      loading: false
    })

    const mergeable = (repos || [])
      // @ts-ignore
      .filter((repo) => repo.owner?.login?.toLowerCase() === ORG.toLowerCase())
      // @ts-ignore
      .filter((repo) => repo.permissions?.push || repo.permissions?.maintain || repo.permissions?.admin)
      // @ts-ignore
      .map((repo) => ({
        repo: repo.name,
        permission: highestPermission(repo.permissions)
      }))
      .sort((/** @type {{ repo: string }} */ a, /** @type {{ repo: string }} */ b) => a.repo.localeCompare(b.repo))

    if (mergeable.length === 0) {
      console.log(chalk.yellow(`Nenhum repositório da org ${ORG} com permissão de merge`))
      return
    }

    console.log('')
    console.log(chalkTable({
      columns: [
        { field: 'repo', name: chalk.cyan('Repo') },
        { field: 'permission', name: chalk.cyan('Permissão') }
      ]
    }, mergeable))
    console.log('')
    console.log(chalk.dim(`${mergeable.length} repositórios`))
  }
}

/**
 * @param {{ admin?: boolean; maintain?: boolean; push?: boolean }} permissions
 * @returns {string}
 */
function highestPermission (permissions) {
  if (permissions.admin) return 'admin'
  if (permissions.maintain) return 'maintain'
  return 'push'
}

export default new ReposCommand()
