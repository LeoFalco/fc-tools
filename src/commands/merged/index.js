// @ts-check

import chalk from 'chalk'
import chalkTable from 'chalk-table'
import { format, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import inquirer from 'inquirer'
import { chain } from 'lodash-es'
import { TEAMS } from '../../core/constants.js'
import { githubFacade } from '../../core/githubFacade.js'
import { dateFilter, dateValidator, notNullValidator } from '../../core/validators.js'
import { coloredConclusion, coloredStatus, getTeamByAssignee } from '../../utils/utils.js'
import { sheets } from '../../core/drive.js'
import { sleep } from '../../utils/sleep.js'

class PrMergedCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('merged')
      .description('list open pull requests')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   * @param {boolean | undefined} options.generate
   */
  async action (options) {
    // @ts-ignore
    const { startDate, endDate, team } = await inquirer.prompt([
      {
        type: 'list',
        message: 'Por favor selecione o time que deseja analisar',
        name: 'team',
        choices: Object.keys(TEAMS),
        validate: notNullValidator('Por favor selecione um time')
      },
      {
        type: 'input',
        name: 'startDate',
        message: 'Informe a data inicial no formato yyyy-mm-dd',
        default: new Date().toISOString().split('T').shift(),
        validate: dateValidator,
        filter: dateFilter
      },
      {
        type: 'input',
        name: 'endDate',
        message: 'Informe a data final no formato yyyy-mm-dd',
        default: new Date().toISOString().split('T').shift(),
        validate: dateValidator,
        filter: dateFilter
      }
    ]).catch((error) => {
      if (error.message.includes('closed the prompt')) {
        console.log('Operação cancelada pelo usuário')
        process.exit(1)
      }

      throw error
    })

    const assignees = TEAMS[team]

    const pulls = await githubFacade.listOpenPullRequestsV2({
      assignees,
      state: 'MERGED',
      organization: 'FieldControl'
    }).then((pulls) => {
      return pulls.filter((pull) => {
        const mergedDate = pull.pull_request.merged_at.split('T').shift()
        return mergedDate && mergedDate >= startDate && mergedDate <= endDate
      })
    })

    for (const pull of pulls) {
      pull.mergedAt = format(toZonedTime(parseISO(pull.pull_request.merged_at), 'America/Sao_Paulo'), 'yyyy-MM-dd HH:mm')
      pull.team = getTeamByAssignee(pull.assignee?.login)
    }

    console.log('')
    console.log('PRs publicados')
    console.log(chalkTable({
      columns: [
        { field: 'link', name: chalk.green('Link') },
        { field: 'author', name: chalk.green('Author') },
        { field: 'title', name: chalk.green('Title') },
        { field: 'team', name: chalk.green('Team') },
        { field: 'mergedAt', name: chalk.green('Merged At') }
      ]
    }, pulls.map(pull => {
      return {
        mergedAt: pull.mergedAt,
        link: pull.html_url,
        title: pull.title,
        author: pull.user.login,
        team: pull.team
      }
    })))

    await sheets.spreadsheets.values.clear({
      spreadsheetId: '1gQz-I9MPygcUo1nCtUoWXSOvIiZVedoWnj76A3dh6yA',
      range: 'A1:Z1000'
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: '1gQz-I9MPygcUo1nCtUoWXSOvIiZVedoWnj76A3dh6yA',
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: toRows(pulls)
      }
    })

    await startPublishPooling(pulls)
  }
}

function toRows (pulls) {
  return [
    ['Link', 'Author', 'Title', 'Team', 'Merged At'],
    ...pulls.map(pull => {
      return [
        pull.html_url,
        pull.user.login,
        pull.title,
        getTeamByAssignee(pull.assignee?.login),
        pull.mergedAt
      ]
    })
  ]
}

async function startPublishPooling (pulls) {
  console.log('Iniciando pooling de publicação')

  pulls = chain(pulls)
    .uniqBy(pull => pull.repository_url)
    .value()

  while (true) {
    for (const pull of pulls) {
      console.log('pull', pull.html_url)
      const extractOwnerAndRepo = /https:\/\/github.com\/(.+?)\/(.+?)\//.exec(pull.html_url) || []

      const owner = extractOwnerAndRepo[1]
      const repo = extractOwnerAndRepo[2]

      const job = await githubFacade.listWorkflowJobs({
        owner,
        repo
      })

      pull.isPublishing = job ? job.status !== 'completed' : false
      pull.status = job?.status
      pull.conclusion = job?.conclusion
      pull.job_url = job?.html_url

      console.log([coloredStatus(pull.status), coloredConclusion(pull.conclusion)].join(' '), pull.job_url)
    }

    pulls = pulls.filter((pull) => pull.isPublishing)
    if (!pulls.length) break
    console.log(new Date().toISOString(), 'Some PRs are still being published. Waiting 5 seconds to check again...')
    await sleep(5000)
  }
}

export default new PrMergedCommand()
