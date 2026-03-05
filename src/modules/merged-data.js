// @ts-check

import { differenceInBusinessDays, format, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { chain } from 'lodash-es'
import { TEAMS } from '../core/constants.js'
import { githubFacade } from '../core/githubFacade.js'
import { getTeamByAssignee } from '../utils/utils.js'

export async function fetchMergedPRs (team, from, to) {
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

  const memberStats = chain(pulls)
    .groupBy((pull) => pull.author?.login)
    .map((memberPulls, author) => ({
      author,
      count: memberPulls.length
    }))
    .sortBy('count')
    .reverse()
    .value()

  return { pulls, memberStats }
}
