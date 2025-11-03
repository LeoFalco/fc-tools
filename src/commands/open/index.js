// @ts-check
import chalk from 'chalk'
import chalkTable from 'chalk-table'
import { fluxClient, PIPES } from '../../services/flux/flux-client.js'

class PrOpenedCommand {
  /**
   *
   * @param {Object} param
   * @param {import('commander').Command} param.program
   * @returns
   * */
  install ({ program }) {
    program
      .command('open')
      .description('list open pull requests')
      .action(this.action.bind(this))
  }

  /**
   * @param {Object} options
   */
  async action (options) {
    const stages = await fluxClient.getPipe({ pipeId: PIPES.CMMS_PROJECT })

    console.log('Open Pull Requests:\n')

    const labelsIds = [
      '715f898f-eab7-4933-8cc0-39997fe7b459' // Label ID for "Pagamentos"
    ]

    const doneCards = []

    for (const stage of stages.stages) {
      const cards = await fluxClient.getUnopenedCards({
        stageId: stage.id,
        skip: 0,
        take: 1000,
        archived: true, // prontos
        labelsIds
      })

      console.log(`Stage: ${stage.name}\n`)
      if (cards.length === 0) {
        console.log('No cards in stage')
        continue
      }

      for (const card of cards) {
        card.doneEstimation = getCardEstimation(card)
        console.log(`- ${card.name}`, card.doneEstimation)
      }
      stage.doneEstimation = cards.reduce((sum, card) => sum + card.doneEstimation, 0)
      stage.doneCount = cards.filter(card => card.doneEstimation > 0).length
      console.log('Stage done estimation total: ', stage.doneEstimation)
      console.log('Stage done count total: ', stage.doneCount)
      doneCards.push(...cards)
    }

    const todoCards = []
    const doingCards = [

    ]
    const doingStages = [
      'todo',
      'doing',
      'review',
      'testes',
      'publish'
    ]
    for (const stage of stages.stages) {
      const isDoingStage = doingStages.some(doingStage => stage.name.toLowerCase().includes(doingStage))
      const cards = await fluxClient.getUnopenedCards({
        stageId: stage.id,
        skip: 0,
        take: 1000,
        archived: false, // a fazer
        labelsIds
      })

      console.log(`Stage: ${stage.name}\n`)
      if (cards.length === 0) {
        console.log('No cards in stage')
        continue
      }

      for (const card of cards) {
        if (isDoingStage) {
          card.doingEstimation = getCardEstimation(card)
          console.log(`- ${card.name}`, card.doingEstimation)
        } else {
          card.todoEstimation = getCardEstimation(card)
          console.log(`- ${card.name}`, card.todoEstimation)
        }
      }

      if (isDoingStage) {
        doingCards.push(...cards)
      } else {
        todoCards.push(...cards)
      }

      stage.doingEstimation = cards.reduce((sum, card) => sum + card.doingEstimation || 0, 0)
      stage.doingCount = cards.filter(card => card.doingEstimation > 0).length

      stage.todoEstimation = cards.reduce((sum, card) => sum + card.todoEstimation || 0, 0)
      stage.todoCount = cards.filter(card => card.todoEstimation > 0).length

      console.log('')
      console.log('Stage doing estimation total: ', stage.doingEstimation)
      console.log('Stage doing count total: ', stage.doingCount)
      console.log('Stage todo estimation total: ', stage.todoEstimation)
      console.log('Stage todo count total: ', stage.todoCount)
    }

    const doneEstimationCount = stages.stages.map(stage => stage.doneCount).reduce((sum, val) => sum + (val || 0), 0)
    const doneEstimationTotal = stages.stages.map(stage => stage.doneEstimation).reduce((sum, val) => sum + (val || 0), 0)
    const todoEstimationCount = stages.stages.map(stage => stage.todoCount).reduce((sum, val) => sum + (val || 0), 0)
    const todoEstimationTotal = stages.stages.map(stage => stage.todoEstimation).reduce((sum, val) => sum + (val || 0), 0)
    const doingEstimationCount = doingCards.filter(card => card.doingEstimation > 0).length
    const doingEstimationTotal = doingCards.map(card => card.doingEstimation || 0).reduce((sum, val) => sum + val, 0)

    const totalEstimation = doneEstimationTotal + todoEstimationTotal + doingEstimationTotal
    const totalCount = doneEstimationCount + todoEstimationCount + doingEstimationCount
    const donePercentage = doneEstimationTotal / (totalEstimation)
    const doingPercentage = doingEstimationTotal / (totalEstimation)
    const todoPercentage = todoEstimationTotal / (totalEstimation)

    const teamVelocityPerWeek = 4 * 8 // 4 pessoas, 8 pontos cada por semana
    const weeksNeeded = (todoEstimationTotal) / teamVelocityPerWeek
    const today = new Date()
    const dueDate = new Date()

    console.log('')
    console.log('Publicados')
    console.log(chalkTable({
      columns: [
        { field: 'name', name: chalk.green('Name') },
        { field: 'estimation', name: chalk.green('Estimation') }
      ]
    }, doneCards.map(card => {
      return {
        name: card.name,
        estimation: card.doneEstimation
      }
    })))
    console.log(`Total de cards concluídos: ..........${doneEstimationCount} cards`)
    console.log(`Estimativa total concluída: .........${doneEstimationTotal} pontos`)
    console.log('Porcentagem concluída: ...............' + (donePercentage * 100).toFixed(2) + '%')

    console.log('')
    console.log('Em andamento')
    console.log(chalkTable({
      columns: [
        { field: 'name', name: chalk.green('Name') },
        { field: 'estimation', name: chalk.green('Estimation') }
      ]
    }, doingCards.map(card => {
      return {
        name: card.name,
        estimation: card.doingEstimation
      }
    })))
    console.log(`Total de cards em andamento: .......${doingEstimationCount} cards`)
    console.log(`Estimativa total em andamento: .....${doingEstimationTotal} pontos`)
    console.log('Porcentagem em andamento: ...........' + (doingPercentage * 100).toFixed(2) + '%')

    console.log('')
    console.log('A fazer')
    console.log(chalkTable({
      columns: [
        { field: 'name', name: chalk.green('Name') },
        { field: 'estimation', name: chalk.green('Estimation') }
      ]
    }, todoCards.map(card => {
      return {
        name: card.name,
        estimation: card.todoEstimation
      }
    })))
    console.log(`Total de cards a fazer: .............${todoEstimationCount} cards`)
    console.log(`Estimativa total a fazer: ...........${todoEstimationTotal} pontos`)
    console.log('Porcentagem a fazer: .................' + (todoPercentage * 100).toFixed(2) + '%')
    console.log('')

    dueDate.setDate(today.getDate() + Math.ceil(weeksNeeded * 7))

    console.log('')
    console.log(`Total de cards: .....................${totalCount} cards`)
    console.log(`Estimativa total: ...................${totalEstimation} pontos`)

    console.log(`Porcentagem geral concluída: ........${(donePercentage * 100).toFixed(2)}%`)
    console.log(`Velocidade da equipe por semana: ....${teamVelocityPerWeek} pontos`)
    console.log(`Semanas estimadas para conclusão: ...${weeksNeeded.toFixed(2)} semanas`)
    console.log(`Data estimada de conclusão: .........${dueDate.toISOString().split('T')[0].split('-').reverse().join('/')}`)
  }
}

function getCardEstimation (card) {
  const pausedLabel = card.labels.find(label => label.label.name.toLowerCase().includes('pause'))
  if (pausedLabel) return 0

  const estimationLabel = card.labels.find(label => label.label.name.toLowerCase().includes('esforço'))
  if (!estimationLabel) return 0

  const estimationMatch = estimationLabel.label.name.match(/\d+/)

  return estimationMatch ? parseInt(estimationMatch[0], 10) : 0
}

export default new PrOpenedCommand()

// 110 total de esforço
// 10 por pessoa por semana
// 4 pessoas = 40 por semana
// 110 / 40 = 2.75 semanas
// + 1 semana de buffer = 3.75 semanas ~ 4 semanas
