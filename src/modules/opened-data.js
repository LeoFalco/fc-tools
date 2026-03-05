// @ts-check

import { format } from 'date-fns'
import { chain, map, max, mean, sum } from 'lodash-es'
import { QUALITY_TEAM, TEAMS } from '../core/constants.js'
import { githubFacade } from '../core/githubFacade.js'
import { calcAge, hasPublishLabel, isApproved, isChecksPassed, isChecksInProgress, isMergeable, isNotFreelance, isNotWait, isQualityOk, isReady, isRejected } from '../utils/utils.js'

export async function fetchOpenedPRs (team) {
  const assignees = TEAMS[team]

  const now = new Date()
  const from = format(now, 'yyyy-MM-dd')
  const tenYearsAgo = new Date(now)
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)
  const to = format(tenYearsAgo, 'yyyy-MM-dd')

  const pulls = await githubFacade.listPullRequestsV2({
    assignees,
    organization: 'FieldControl',
    state: 'OPEN',
    from,
    to
  }).then((pulls) => {
    return chain(pulls)
      .filter(isNotFreelance)
      .filter(isNotWait)
      .map((pull) => {
        const approved = isApproved(pull)
        const notRejected = !isRejected(pull)
        const mergeable = isMergeable(pull)
        const checks = isChecksPassed(pull)
        const checksInProgress = isChecksInProgress(pull)
        const quality = isQualityOk(pull, QUALITY_TEAM) || hasPublishLabel(pull)
        const ready = isReady(pull)
        const age = calcAge(pull)

        pull.score = sum([approved, mergeable, checks, quality, ready].map((param) => (param ? 1 : 0)))
        pull.approved = approved
        pull.notRejected = notRejected
        pull.mergeable = mergeable
        pull.checks = checks
        pull.checksInProgress = checksInProgress
        pull.ready = ready
        pull.quality = quality
        pull.age = age

        const teamReviewers = TEAMS[team].filter((login) => login !== pull.author?.login)
        const approvedReviewers = pull.reviews.nodes.filter((/** @type {{ state: string; }} */ review) => review.state === 'APPROVED').map((/** @type {{ author: { login: any; }; }} */ review) => review.author?.login)
        const missingReviewers = teamReviewers.filter((login) => !approvedReviewers.includes(login))
        pull.missingReviewers = missingReviewers
        return pull
      })
      .sortBy((pull) => pull.score)
      .reverse()
      .value()
  })

  const memberStats = chain(pulls)
    .groupBy((pull) => pull.author?.login)
    .map((memberPulls, author) => ({
      author,
      count: memberPulls.length,
      oldestAge: max(map(memberPulls, 'age')) || 0
    }))
    .sortBy('count')
    .reverse()
    .value()

  const totalPrs = pulls.length
  const avgAge = totalPrs > 0 ? Number(mean(map(pulls, (pull) => pull.age)).toFixed(0)) : 0

  return { pulls, memberStats, totalPrs, avgAge }
}
