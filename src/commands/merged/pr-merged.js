// @ts-check

import { format, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { chain } from 'lodash-es'
import { oraPromise } from 'ora'
import { TEAMS } from '../../core/constants.js'
import { githubFacade } from '../../core/githubFacade.js'
import { coloredConclusion, coloredStatus, formatTitle, padEnd, red } from '../core/utils.js'
import { sleep } from '../../utils/sleep.js'

async function run () {
  const assignees = TEAMS[team]
  console.log('Datas selecionadas:', { startDate, endDate })

  console.log('Membros selecionados:', assignees.join(', '))

  const pulls = await oraPromise(
    githubFacade.listPullRequests({
      assignees,
      state: 'MERGED',
      organization: 'FieldControl'
    }),
    {
      text: 'Consultando dados de pull requests...'
    }
  ).then((pulls) => {
    return pulls.filter((pull) => {
      const mergedDate = pull.mergedAt.split('T').shift()

      return mergedDate && mergedDate >= startDate && mergedDate <= endDate
    })
  })

  chain(pulls)
    .sortBy(pull => pull.mergedAt)
    .value()
    .forEach((pull) => {
      const { author, url, title } = pull

      const mergedAt = format(toZonedTime(parseISO(pull.mergedAt), 'America/Sao_Paulo'), 'yyyy-MM-dd HH:mm')

      console.log([red({ merged: true }), padEnd(mergedAt, 16), padEnd(author.login, 15), padEnd(url, 55), formatTitle(title)].join(' '))
    })

  console.log('Quantidade de prs publicados: ', pulls.length.toFixed(0))

  await startPublishPooling(pulls)
}

async function startPublishPooling (pulls) {
  console.log('Iniciando pooling de publicação')

  pulls = chain(pulls)
    .uniqBy(pull => pull.repository.name)
    .value()

  while (true) {
    for (const pull of pulls) {
      const job = await githubFacade.listWorkflowJobs({
        owner: pull.repository.owner.login,
        repo: pull.repository.name
      })

      pull.isPublishing = job.status !== 'completed'
      pull.status = job.status
      pull.conclusion = job.conclusion
      pull.job_url = job.html_url

      console.log([coloredStatus(pull.status), coloredConclusion(pull.conclusion)].join(' '), pull.job_url)
    }

    pulls = pulls.filter((pull) => pull.isPublishing)
    if (!pulls.length) break
    console.log(new Date().toISOString(), 'Some PRs are still being published. Waiting 5 seconds to check again...')
    await sleep(5000)
  }
}

run()
