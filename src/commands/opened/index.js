// @ts-check

import chalk from 'chalk'
import chalkTable from 'chalk-table'
import inquirer from 'inquirer'
import { chain, map, mean, sum } from 'lodash-es'
import { QUALITY_TEAM, TEAMS } from '../../core/constants.js'
import { githubFacade } from '../../core/githubFacade.js'
import { notNullValidator } from '../../core/validators.js'
import { calcAge, getTeamByAssignee, hasPublishLabel, isApproved, isChecksPassed, isMergeable, isNotFieldBounty, isNotFreelance, isNotWait, isQualityOk, isReady, isRejected } from '../../utils/utils.js'
import { sheets } from '../../core/drive.js'

class PrOpenedCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('opened')
      .description('list open pull requests')
      .option('-t, --team [team]', 'team to list pull requests')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   * @param {boolean | undefined} options.team
   */
  async action (options) {
    // @ts-ignore
    const team = options.team || await inquirer.prompt([
      {
        type: 'list',
        message: 'Por favor selecione o time que deseja analisar',
        name: 'team',
        choices: Object.keys(TEAMS),
        validate: notNullValidator('Por favor selecione um time')
      }
    ]).then((answers) => answers.team)

    if (!TEAMS[team]) {
      throw new Error('Time não encontrado')
    }

    const assignees = TEAMS[team]

    console.log('Membros selecionados:', assignees.join(', '))
    console.log('Membros de qualidade:', QUALITY_TEAM.join(', '))

    const pulls = await githubFacade.listOpenPullRequestsV2({
      assignees,
      organization: 'FieldControl',
      state: 'OPEN'
    }).then((pulls) => {
      return chain(pulls)
        .filter(isNotFreelance)
        .filter(isNotFieldBounty)
        .filter(isNotWait)
        .map((pull) => {
          const approved = isApproved(pull)
          const notRejected = !isRejected(pull)
          const mergeable = isMergeable(pull)
          const checks = isChecksPassed(pull)
          const quality = isQualityOk(pull, QUALITY_TEAM) || hasPublishLabel(pull)
          const ready = isReady(pull)
          const age = calcAge(pull)

          pull.score = sum([approved, mergeable, checks, quality, ready].map((param) => (param ? 1 : 0)))
          pull.approved = approved
          pull.notRejected = notRejected
          pull.mergeable = mergeable
          pull.checks = checks
          pull.ready = ready
          pull.quality = quality
          pull.age = age

          const teamReviewers = TEAMS[team].filter((login) => login !== pull.author?.login)
          const approvedReviewers = pull.reviews.nodes.filter((review) => review.state === 'APPROVED').map((review) => review.author?.login)
          const missingReviewers = teamReviewers.filter((login) => !approvedReviewers.includes(login))
          pull.missingReviewers = missingReviewers
          return pull
        })
        .sortBy((pull) => pull.score)
        .reverse()
        .value()
    })

    console.log('')
    console.log('PRs abertos')
    console.log(chalkTable({
      columns: [
        { field: 'link', name: chalk.cyan('Link') },
        { field: 'title', name: chalk.cyan('Title') },
        { field: 'author', name: chalk.cyan('Author') },
        { field: 'ready', name: chalk.cyan('Draft') },
        { field: 'mergeable', name: chalk.cyan('Mergeable') },
        { field: 'checks', name: chalk.cyan('Checks') },
        { field: 'review', name: chalk.cyan('Review') },
        { field: 'notRejected', name: chalk.cyan('Approved') },
        { field: 'quality', name: chalk.cyan('Quality') },
        { field: 'team', name: chalk.cyan('Team') }
      ]
    }, pulls.map((pull) => {
      return {
        ready: pull.ready ? chalk.green('✓') : chalk.red('✕'),
        mergeable: pull.mergeable ? chalk.green('✓') : chalk.red('✕'),
        checks: pull.checks ? chalk.green('✓') : chalk.red('✕'),
        review: pull.approved ? chalk.green('✓') : chalk.red('✕'),
        notRejected: pull.notRejected ? chalk.green('✓') : chalk.red('✕'),
        quality: pull.quality ? chalk.green('✓') : chalk.red('✕'),
        link: pull.url,
        author: pull.author?.login,
        title: pull.title,
        team: getTeamByAssignee(pull.author?.login)
      }
    })))

    const currentUser = await githubFacade.getCurrentUser()

    const myPulls = pulls.filter((pull) => pull.author?.login === currentUser.data.login)
    console.log('')
    console.log('Meus PRs')
    console.log(chalkTable({
      columns: [
        { field: 'link', name: chalk.cyan('Link') },
        { field: 'title', name: chalk.cyan('Title') },
        { field: 'ready', name: chalk.cyan('Draft') },
        { field: 'mergeable', name: chalk.cyan('Mergeable') },
        { field: 'checks', name: chalk.cyan('Checks') },
        { field: 'review', name: chalk.cyan('Review') },
        { field: 'notRejected', name: chalk.cyan('Approved') },
        { field: 'quality', name: chalk.cyan('Quality') }
      ]
    }, myPulls.map((pull) => {
      return {
        ready: pull.ready ? chalk.green('✓') : chalk.red('✕'),
        mergeable: pull.mergeable ? chalk.green('✓') : chalk.red('✕'),
        checks: pull.checks ? chalk.green('✓') : chalk.red('✕'),
        review: pull.approved ? chalk.green('✓') : chalk.red('✕'),
        notRejected: pull.notRejected ? chalk.green('✓') : chalk.red('✕'),
        quality: pull.quality ? chalk.green('✓') : chalk.red('✕'),
        link: pull.url,
        author: pull.author?.login,
        title: pull.title
      }
    })))

    const teamMembers = TEAMS[team]

    for (const teamMember of teamMembers) {
      const prsWithoutMemberApproval = pulls
        .filter((pull) => pull.missingReviewers?.includes(teamMember))
        .filter((pull) => !pull.approved)
        .filter((pull) => pull.notRejected)
        .filter((pull) => pull.mergeable)
        .filter((pull) => pull.checks)
        .filter((pull) => pull.ready)

      const prsWithMemberApprovalCount = pulls.filter((pull) => !pull.missingReviewers?.includes(teamMember)).length

      console.log('')
      console.log(`Prs com review de ${teamMember}`, prsWithMemberApprovalCount)
      console.log(`PRs com review pendente de ${teamMember}`)

      console.log(chalkTable({
        columns: [
          { field: 'link', name: chalk.cyan('Link') },
          { field: 'title', name: chalk.cyan('Title') },
          { field: 'author', name: chalk.cyan('Author') }
        ]
      }, prsWithoutMemberApproval.map((pull) => {
        return {
          link: pull.url,
          author: pull.author?.login,
          title: pull.title
        }
      })))
    }

    console.log('')
    console.log('Quantidade de prs abertos: ', pulls.length.toFixed(0))
    console.log('Idade média: ' + mean(map(pulls, (pull) => pull.age)).toFixed(0) + ' dias corridos')
    console.log('Cada autor tem a responsabilidade zelar pelo seu pr até que ele seja publicado')
    console.log('Oque fazer em cada caso:')
    console.log(
      'Meu pr não está aprovado: Verificar os comentários e corrigir o que for necessário, solicitar revisão novamente'
    )
    console.log('Meu pr não está margeável: Verificar os conflitos e fazer o rebase')
    console.log('Meu pr não está ready: Verificar se o pr está marcado como draft e desmarcar se for o caso')
    console.log('Meu pr não passou nos checks: Verificar os logs da ci e corrigir o que for necessário')
    console.log(
      'Meu pr não está aprovado pela qualidade: Verificar com o time de qualidade o que precisa ser corrigido, ajustar e solicitar revisão novamente'
    )
    console.log('Nota para os membros do time:')
    console.log(
      'Lembre-se de revisar os prs dos colegas, pois a revisão de código é uma prática importante para manter a qualidade do código'
    )

    await sheets.spreadsheets.values.clear({
      spreadsheetId: '1HfU9yvsmK4yBFDkquozdx4IcGo34NpvKHIlRG5A77Ro',
      range: 'A1:Z1000'
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: '1HfU9yvsmK4yBFDkquozdx4IcGo34NpvKHIlRG5A77Ro',
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: toRows(pulls)
      }
    })
  }
}

function toRows (pulls) {
  const rows = pulls.map((pull) => {
    return [
      pull.url,
      pull.title,
      pull.author?.login,
      pull.ready ? 'yes' : 'no',
      pull.mergeable ? 'yes' : 'no',
      pull.checks ? 'yes' : 'no',
      pull.approved ? 'yes' : 'no',
      pull.quality ? 'yes' : 'no',
      pull.team,
      pull.age
    ]
  })

  return [
    [
      'Link',
      'Title',
      'Author',
      'Draft',
      'Mergeable',
      'Checks',
      'Review',
      'Quality',
      'Team',
      'Age'
    ],
    ...rows
  ]
}

export default new PrOpenedCommand()
