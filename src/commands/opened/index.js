// @ts-check

import axios from 'axios'
import chalk from 'chalk'
import chalkTable from 'chalk-table'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { chain, map, mean } from 'lodash-es'
import { sheets } from '../../core/drive.js'
import { githubFacade } from '../../core/githubFacade.js'
import { fetchOpenedPRs } from '../../modules/opened-data.js'
import { promptTeam } from '../../utils/prompt.js'

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
      .option('--chat', 'send output to google chat webhook')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   * @param {boolean | undefined} options.team
   */
  async action (options) {
    // @ts-ignore
    const team = await promptTeam(options)

    const { pulls, memberStats } = await fetchOpenedPRs(team)

    const pullsSortedByAuthorAndAge = chain(pulls)
      .sortBy((pull) => -pull.age)
      .sortBy((pull) => pull.author?.login)
      .value()

    console.log('')
    console.log('PRs abertos')
    console.log(chalkTable({
      columns: [
        { field: 'link', name: chalk.cyan('Link') },
        { field: 'title', name: chalk.cyan('Title') },
        { field: 'author', name: chalk.cyan('Author') },
        { field: 'age', name: chalk.cyan('Age') },
        { field: 'ready', name: chalk.cyan('Draft') },
        { field: 'mergeable', name: chalk.cyan('Mergeable') },
        { field: 'checks', name: chalk.cyan('Checks') },
        { field: 'review', name: chalk.cyan('Review') },
        { field: 'notRejected', name: chalk.cyan('Approved') },
        { field: 'quality', name: chalk.cyan('Quality') }
      ]
    }, pullsSortedByAuthorAndAge.map((pull) => {
      return {
        ready: pull.ready ? chalk.green('✓') : chalk.red('✕'),
        mergeable: pull.mergeable ? chalk.green('✓') : chalk.red('✕'),
        checks: pull.checks ? chalk.green('✓') : chalk.red('✕'),
        review: pull.approved ? chalk.green('✓') : chalk.red('✕'),
        notRejected: pull.notRejected ? chalk.green('✓') : chalk.red('✕'),
        quality: pull.quality ? chalk.green('✓') : chalk.red('✕'),
        link: pull.url,
        author: pull.author?.login,
        age: pull.age + 'd',
        title: pull.title.substring(0, 60) + (pull.title.length > 60 ? '...' : '')
      }
    })))

    const currentUser = await githubFacade.getCurrentUser()

    const myPulls = pulls.filter((pull) => pull.author?.login === currentUser.data.login)
    console.log('')
    console.log('Meus PRs')
    console.log(chalkTable({
      columns: [
        { field: 'link', name: chalk.cyan('Url') },
        { field: 'title', name: chalk.cyan('Title') },
        { field: 'ready', name: chalk.cyan('Draft') },
        { field: 'mergeable', name: chalk.cyan('Merge') },
        { field: 'checks', name: chalk.cyan('Check') },
        { field: 'review', name: chalk.cyan('Review') },
        { field: 'notRejected', name: chalk.cyan('Approve') },
        { field: 'quality', name: chalk.cyan('Qa') }
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

    console.log('')
    console.log('PRs abertos por membro')
    console.log(chalkTable({
      columns: [
        { field: 'author', name: chalk.cyan('Membro') },
        { field: 'count', name: chalk.cyan('PRs abertos') },
        { field: 'oldestAge', name: chalk.cyan('Idade do mais velho (dias)') }
      ]
    }, memberStats))

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

    if (options.chat) {
      await sendToGoogleChat(pullsSortedByAuthorAndAge, memberStats, team)
    }
  }
}

const GOOGLE_CHAT_WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK_URL

async function sendToGoogleChat (pulls, memberStats, team) {
  const today = format(new Date(), 'dd/MM/yyyy (EEEE)', { locale: ptBR })

  if (pulls.length === 0) {
    const text = `*PRs abertos - ${team} - ${today}*\n\nNenhum PR aberto no momento. Tudo limpo!`
    await axios.post(GOOGLE_CHAT_WEBHOOK_URL, { text }, {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' }
    })
    console.log('')
    console.log('Mensagem enviada para o Google Chat!')
    return
  }

  const lines = [`*PRs abertos - ${team} - ${today}*`]

  const grouped = chain(pulls)
    .groupBy((pull) => pull.author?.login)
    .value()

  for (const [author, authorPulls] of Object.entries(grouped)) {
    lines.push('')
    const authorName = authorPulls[0].author?.name
    lines.push(authorName ? `*${authorName}* (${author})` : `*${author}*`)
    for (const pull of authorPulls) {
      const cleanTitle = pull.title.replace(/<>/g, '-').replace(/\p{Emoji_Presentation}/gu, '').replace(/\s+/g, ' ').trim()
      const safeTitle = cleanTitle.length > 70 ? cleanTitle.substring(0, 70) + '...' : cleanTitle
      const status = [
        `${pull.mergeable ? '🟢' : '🔴'} Conflitos`,
        `${pull.checks ? '🟢' : pull.checksInProgress ? '🟡' : '🔴'} CI`,
        `${pull.approved ? '🟢' : '🔴'} Aprovado`,
        `${pull.notRejected ? '🟢' : '🔴'} Mudanças Solicitadas`,
        `${pull.quality ? '🟢' : '🔴'} Qualidade`
      ].join(' | ')
      lines.push(`- <${pull.url}|${safeTitle}> (${pull.age}d)`)
      lines.push(`  ${status}`)
    }
  }

  lines.push('')
  lines.push('*PRs por membro*')
  lines.push('```')
  const maxAuthorLen = Math.max(...memberStats.map((m) => m.author.length), 'Membro'.length)
  lines.push(`${'Membro'.padEnd(maxAuthorLen)} | PRs | Mais velho`)
  lines.push(`${'-'.repeat(maxAuthorLen)}-+-----+-----------`)
  for (const member of memberStats) {
    lines.push(`${member.author.padEnd(maxAuthorLen)} | ${String(member.count).padStart(3)} | ${member.oldestAge}d`)
  }
  lines.push('```')

  const totalPrs = pulls.length
  const avgAge = totalPrs > 0 ? mean(map(pulls, (pull) => pull.age)).toFixed(0) : 0
  lines.push('')
  lines.push('```')
  lines.push(`Total: ${totalPrs} PRs`)
  lines.push(`Idade média: ${avgAge} dias`)
  lines.push('```')
  lines.push('')
  lines.push('<users/all>')

  const text = lines.join('\n')

  await axios.post(GOOGLE_CHAT_WEBHOOK_URL, { text }, {
    headers: { 'Content-Type': 'application/json; charset=UTF-8' }
  })

  console.log('')
  console.log('Mensagem enviada para o Google Chat!')
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
