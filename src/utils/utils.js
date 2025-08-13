import { Chalk } from 'chalk'
import { differenceInDays, parseISO } from 'date-fns'
import { TEAMS } from '../core/constants.js'

export const chalk = new Chalk()

export function isReady (pull) {
  return !pull.isDraft && !pull.labels.nodes.some((label) => label.name.toLowerCase().includes('wait'))
}

export function isApproved (pull) {
  return pull.reviewDecision === 'APPROVED'
}

export function isRejected (pull) {
  return pull.reviewDecision === 'CHANGES_REQUESTED'
}

export function isMergeable (pull) {
  return pull.mergeable === 'MERGEABLE'
}

export function isMerged (pull) {
  return pull.state === 'MERGED'
}

export function isQualityOk (pull, qualityUsers) {
  return pull.reviews.nodes.some((review) => {
    return review.author && qualityUsers.includes(review.author?.login) && review.state === 'APPROVED'
  })
}

export function hasPublishLabel (pull) {
  return pull.labels.nodes.some((label) => label.name.toLowerCase().includes('publish'))
}

export function isNotFreelance (pull) {
  return !pull.labels.nodes.find((label) => label.name.toLowerCase().includes('freelance'))
}

export function isNotFieldBounty (pull) {
  return !pull.labels.nodes.find((label) => label.name.toLowerCase().includes('FieldBounty'))
}

export function isNotWait (pull) {
  return !pull.labels.nodes.some((label) => label.name.toLowerCase().includes('wait'))
}

export function isChecksPassed (pull) {
  const checksByName = pull.checks
    .filter((check) => check.name !== 'PR Pattern')
    .reduce((acc, check) => {
      acc[check.name] = acc[check.name] || []
      acc[check.name].push(check)
      return acc
    }, {})

  Object.keys(checksByName).forEach((name) => {
    checksByName[name] = checksByName[name].filter((check) => ['success', 'skipped'].includes(check.conclusion))
  })

  return Object.values(checksByName).every((checks) => checks.length > 0)
}

export const red = (param) => {
  const [key, value] = Object.entries(param)[0]
  return value ? chalk.green('✅ ' + key) : chalk.red('❌ ' + key)
}

export const calcAge = (pull) => {
  return differenceInDays(Date.now(), parseISO(pull.createdAt))
}

export function padEnd (value, length) {
  return String(value || '')
    .padEnd(length, ' ')
    .substring(0, length)
}

export function formatTitle (title) {
  const titleAString = String(title || '')

  if (titleAString.includes('<>')) {
    return titleAString.substring(titleAString.indexOf('<>') + 2).trim()
  }

  if (titleAString.includes(' - ')) {
    return titleAString.substring(titleAString.indexOf(' - ') + 3).trim()
  }

  return titleAString
}

export function coloredStatus (status) {
  switch (status) {
    case 'in_progress':
      return chalk.yellow(status)
    case 'completed':
      return chalk.green(status)
    default:
      return chalk.blue(status)
  }
}

export function coloredConclusion (conclusion) {
  switch (conclusion) {
    case 'success':
      return chalk.green(conclusion)
    case 'skipped':
      return chalk.gray(conclusion)
    case null:
      return chalk.yellow('pending')
    case 'failure':
      return chalk.red(conclusion)
    default:
      return chalk.blue(conclusion)
  }
}

/**
 * @param {string} assignee
 */
export function getTeamByAssignee (assignee) {
  for (const item of Object.keys(TEAMS)) {
    if (item === 'TODOS' || item === 'CMMS' || item === 'FSM') continue
    if (TEAMS[item].includes(assignee)) return item
  }

  return 'UNKNOWN'
}
