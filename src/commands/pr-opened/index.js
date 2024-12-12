// @ts-check

import inquirer from 'inquirer'
import { chain, groupBy, map, mean, sum } from 'lodash-es'
import { oraPromise } from 'ora'
import { TEAMS } from '../../core/constants.js'
import { githubFacade } from '../../core/githubFacade.js'
import { notNullValidator } from '../../core/validators.js'
import { calcAge, formatTitle, hasPublishLabel, isApproved, isChecksPassed, isMergeable, isQualityOk, isReady, isRejected, padEnd, red } from '../../utils/utils.js'

class PrOpenedCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('pr-opened')
      .description('list open pull requests')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   * @param {boolean | undefined} options.generate
   */
  async action (options) {
    // @ts-ignore
    const { team } = await inquirer.prompt([
      {
        type: 'list',
        message: 'Por favor selecione o time que deseja analisar',
        name: 'team',
        choices: Object.keys(TEAMS),
        validate: notNullValidator('Por favor selecione um time')
      }
    ])

    const assignees = TEAMS[team]

    console.log('Membros selecionados:', assignees.join(', '))

    const qualityUsers = ['viniciusfantoli', 'panegace']

    console.log('Membros de qualidade:', qualityUsers.join(', '))

    const pulls = await oraPromise(
      githubFacade.listOpenPullRequests({
        assignees,
        organization: 'FieldControl'
      }),
      {
        text: 'Consultando dados de pull requests...'
      }
    )

    pulls.forEach((pull) => {
      const approved = isApproved(pull)
      const notRejected = !isRejected(pull)
      const mergeable = isMergeable(pull)
      const checks = isChecksPassed(pull)
      const quality = isQualityOk(pull, qualityUsers) || hasPublishLabel(pull)
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

      pull.readyForTest = pull.approved && pull.checks && pull.ready

      console.log('pull.deployments:', pull.deployments)

    // pull.deploymentUrls = pull.deployments.nodes.map((deployment) => deployment.statuses.nodes.map((status) => status.environmentUrl)).flat()
    })

    for (const pull of pulls) {
      if (pull.approved) continue
      const teamReviewers = TEAMS[team].filter((login) => login !== pull.author.login)
      const approvedReviewers = pull.reviews.nodes.filter((review) => review.state === 'APPROVED').map((review) => review.author.login)
      const missingReviewers = teamReviewers.filter((login) => !approvedReviewers.includes(login))
      pull.missingReviewers = missingReviewers
    }

    chain(pulls)
      .sortBy((pull) => pull.score)
      .reverse()
      .value()
      .forEach((pull) => {
        const { approved, notRejected, mergeable, checks, ready, url, author, title, quality } = pull

        console.log(
          [
            red({ ready }),
            red({ merge: mergeable }),
            red({ check: checks }),
            red({ review: approved }),
            red({ notRejected }),
            red({ qa: quality }),
            padEnd(author.login, 15),
            padEnd(url, 60),
            formatTitle(title)
          ].join(' ')
        )

      // if (pull.deploymentUrls.length > 0) {
      //   console.log('Deployments:', pull.deploymentUrls.join(', '))
      // }
      })

    const { true: approved, false: rejected } = groupBy(pulls, (pull) => {
      return pull.approved && pull.mergeable && pull.checks && pull.ready && pull.quality
    })

    const teamMembers = TEAMS[team]

    for (const teamMember of teamMembers) {
      const prsWithoutMemberApproval = pulls
        .filter((pull) => pull.missingReviewers?.includes(teamMember))
        .filter((pull) => !pull.approved)
        .filter((pull) => pull.notRejected)
        .filter((pull) => pull.mergeable)
        .filter((pull) => pull.checks)
        .filter((pull) => pull.ready)

      if (prsWithoutMemberApproval.length === 0) continue
      console.log('')
      console.log(`PRs com review pendente de ${teamMember}`)
      prsWithoutMemberApproval.slice(0, 5).forEach((pull) => {
        const { approved, url, author, title } = pull

        console.log(
          [
            red({ review: approved }),
            padEnd(author.login, 15),
            padEnd(url, 60),
            formatTitle(title)
          ].join(' ')
        )
      })
    }

    console.log('')
    console.log('Quantidade de prs abertos: ', pulls.length.toFixed(0))
    console.log('Quantidade de prs prontos para publicar: ', (approved?.length || 0).toFixed(0))
    console.log('Quantidade de prs que precisam de atenção: ', (rejected?.length || 0).toFixed(0))
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
  }
}

export default new PrOpenedCommand()
