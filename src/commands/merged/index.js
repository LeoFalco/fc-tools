// @ts-check

import chalk from 'chalk'
import chalkTable from 'chalk-table'
import { differenceInBusinessDays, format, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { chain } from 'lodash-es'
import { TEAMS } from '../../core/constants.js'
import { sheets } from '../../core/drive.js'
import { githubFacade } from '../../core/githubFacade.js'
import { promptFrom, promptTeam, promptTo } from '../../utils/prompt-team.js'
import { sleep } from '../../utils/sleep.js'
import { coloredConclusion, coloredStatus, getTeamByAssignee } from '../../utils/utils.js'

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
      .option('-f, --from <from>', 'from date yyyy-mm-dd')
      .option('-t, --to <to>', 'to date yyyy-mm-dd')
      .option('--team <team>', 'team to analyze')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   * @param {string | undefined} options.from
   * @param {string | undefined} options.to
   * @param {string | undefined} options.team
   */
  async action (options) {
    console.log('List pull requests options', options)

    const team = await promptTeam(options)
    const from = await promptFrom(options)
    const to = await promptTo(options)

    console.log('Analisando PRs do time', team, 'entre', from, 'e', to)

    const assignees = TEAMS[team]

    const pulls = await githubFacade.listPullRequestsV2({
      assignees,
      state: 'MERGED',
      organization: 'FieldControl',
      from,
      to
    }).then((pulls) => {
      return pulls.filter((pull) => {
        if (!pull.mergedAt) return false
        const mergedDate = pull.mergedAt.split('T').shift()
        return mergedDate && mergedDate >= from && mergedDate <= to
      })
    })

    for (const pull of pulls) {
      pull.title = pull.title.substring(0, 80) + (pull.title.length > 80 ? '...' : '')
      pull.createdAt = pull.createdAt && format(toZonedTime(parseISO(pull.createdAt), 'America/Sao_Paulo'), 'yyyy-MM-dd HH:mm')
      pull.mergedAt = pull.mergedAt && format(toZonedTime(parseISO(pull.mergedAt), 'America/Sao_Paulo'), 'yyyy-MM-dd HH:mm')
      pull.durationDays = pull.createdAt && pull.mergedAt
        ? Math.max(differenceInBusinessDays(parseISO(pull.mergedAt), parseISO(pull.createdAt)), 1)
        : null

      pull.team = getTeamByAssignee(pull.author?.login)
    }

    console.log('')
    console.log('PRs publicados')
    console.log(chalkTable({
      columns: [
        { field: 'link', name: chalk.green('Link') },
        { field: 'author', name: chalk.green('Author') },
        { field: 'title', name: chalk.green('Title') },
        { field: 'mergedAt', name: chalk.green('Merged At') }
      ]
    }, pulls.map(pull => {
      return {
        mergedAt: pull.mergedAt,
        link: pull.url,
        title: pull.title,
        author: pull.author.login,
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

    console.log('')
    console.log('Dados atualizados: https://docs.google.com/spreadsheets/d/1gQz-I9MPygcUo1nCtUoWXSOvIiZVedoWnj76A3dh6yA')
    console.log('')

    await startPublishPooling(pulls)
  }
}

function toRows (pulls) {
  return [
    ['Link', 'Author', 'Title', 'Team', 'Created At', 'Merged At', 'Duration (business days)'],
    ...pulls.map(pull => {
      return [
        pull.url,
        pull.author?.login,
        pull.title,
        getTeamByAssignee(pull.author?.login),
        pull.createdAt,
        pull.mergedAt,
        pull.durationDays
      ]
    })
  ]
}

async function startPublishPooling (pulls) {
  console.log('Iniciando pooling de publicação')
  console.log('')

  pulls = chain(pulls)
    .uniqBy(pull => pull.repository.name)
    .value()
    .sort((a, b) => a.repository.name.localeCompare(b.repository.name))

  const updatedRepositoryNames = pulls.map(pull => pull.repository.name)
  console.log('Repositórios alterados:')
  for (const updatedRepositoryName of updatedRepositoryNames) {
    console.log(' -', updatedRepositoryName)
  }

  console.log('')

  while (true) {
    for (const pull of pulls) {
      const extractOwnerAndRepo = pull.url.match(/https:\/\/github\.com\/(?<owner>.+?)\/(?<repo>.+?)\//)?.groups || {}
      const owner = extractOwnerAndRepo.owner
      const repo = extractOwnerAndRepo.repo

      if (pull.isPublishing === undefined || pull.isPublishing === true) {
        const job = await githubFacade.listWorkflowJobs({
          owner,
          repo
        })
        pull.isPublishing = job ? job.status !== 'completed' : false
        pull.status = job?.status
        pull.conclusion = job?.conclusion
        pull.job_url = job?.html_url
      }

      console.log([coloredStatus(pull.status), coloredConclusion(pull.conclusion)].join(' '), pull.url, pull.job_url)
    }

    const isAllDone = pulls.every((pull) => !pull.isPublishing)

    if (isAllDone) {
      console.log('')
      console.log(new Date().toISOString(), 'All jobs are completed!')
      console.log('')
      break
    }
    console.log(new Date().toISOString(), 'Some PRs are still being published waiting...')
    await sleep(1000)

    const cleanLinesCount = pulls.length + 1
    process.stdout.moveCursor(0, -cleanLinesCount)
  }
}

export default new PrMergedCommand()
