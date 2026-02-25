import axios from 'axios'

const client = axios.create({
  baseURL: 'https://isengard.fluxcontrol.com.br/api/graphql',
  headers: {
    'Content-Type': 'application/json'
  }
})

export const STAGES = Object.freeze({
  PUBLISH: 'b15af340-425c-444f-8fc6-8187e2b3010b',
  MERGED: '197e0fd9-ef45-4baa-94aa-e50b2a86b9d5',
  LIVE: '90c58464-98f9-48e7-82de-1e4f21b3569d'
})

export const PIPES = Object.freeze({
  GRID_PROJECT: 'e1e2a518-ad83-4a3b-8fd6-3b42bd4d5151'
})

client.interceptors.request.use((config) => {
  config.headers.Authorization = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImIyZTA2OTEwLWY1MDctNDIyOC1iMzEzLWJlYjlhYzljZGMwMyIsImFjY291bnRfaWQiOiJmNGQyZDdmMy05OGIyLTRhNWQtOTg1Zi0xZjZjMThkM2JkZWUiLCJuYW1lIjoiTGVvIEZhbGNvIiwiZW1haWwiOiJsZW9uYXJkb0BmaWVsZGNvbnRyb2wuY29tLmJyIiwiZW1haWxfdmFsaWRhdGVkX2F0IjpudWxsLCJsYXN0X3NlZW5fYXQiOm51bGwsImxhbmd1YWdlIjoicHQtQlIiLCJjcmVhdGVkX2F0IjoiMjAyNC0wOC0zMVQxOToyMzo1OC4wNzdaIiwidXBkYXRlZF9hdCI6IjIwMjQtMDgtMzFUMTk6MjM6NTguMDc3WiIsImF2YXRhcl91cmwiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NKQkJTeTJ2dTFkRjI5LUhmRmRSU1RPYTY2RUFvLWl0eDV5U2RnbW51SHlhWFF2Z0RrPXM5Ni1jIiwiaXNfb3duZXIiOmZhbHNlLCJkZWxldGVkX2F0IjpudWxsLCJlbWFpbF9jb21tdW5pY2F0aW9uX2Rpc2FibGVkIjpmYWxzZSwiaWF0IjoxNzU1MTc0MTI3LCJleHAiOjE3NTU0MzMzMjcsImF1ZCI6ImF1ZDpjbGllbnQiLCJpc3MiOiJodHRwczovL2lzZW5nYXJkLmZsdXhjb250cm9sLmNvbS5iciJ9.JqlhDeWuougTIcocfCxZoDYqk48U8u_POhm30i2pNmg'
  return config
})

// intercept errors and log graphql errors if exists
client.interceptors.response.use(
  response => {
    if (response.data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(response.data.errors, null, 2))
    }
    return response
  },
  error => {
    if (error.response?.data?.errors) {
      console.error('GraphQL Errors:', JSON.stringify(error.response.data.errors, null, 2))
    } else {
      console.error('Error:', error.message)
    }
    return Promise.reject(error)
  }
)

class FluxClient {
  /**
   *
   * @param {Object} params
   * @param {string} params.stageId - ID of the stage to fetch cards from
   * @param {string[]} [params.labelsIds] - Types of labels to filter cards
   * @param {archived} [params.archived] - Whether to include archived cards (default: false)
   * @param {number} [params.take] - Number of items to fetch (default: 10)
   * @param {number} [params.skip] - Number of items to skip (default: 0)
   * @returns {Promise<Array>}
   * @description Fetches unopened cards from a specific stage in Flux.
   * @returns
   */
  async getUnopenedCards ({ stageId, skip = 0, take = 10, labelsIds = [], archived = false }) {
    const response = await client.post('', {
      operationName: 'GetUnopenedCards',
      variables: {
        stageId,
        take,
        sort: { field: 'index', order: 'asc' },
        skip,
        where: {
          labelsFilterBehavior: 'some',
          archived,
          labelsIds
        }
      },
      query: `#graphql
        query GetUnopenedCards($where: FiltersCardsInput, $sort: UnopenedCardsSortInput, $stageId: ID!, $skip: Int, $take: Int) {
          unopenedCards(
            where: $where
            stageId: $stageId
            skip: $skip
            take: $take
            sort: $sort
          ) {
            items {
              id
              name
              description
              pipe {
                id
                name
              }
              currentStage {
                id
                name
              }
              labels {
                label {
                  id
                  name
                }
              }
            }
          }
        }
      `
    })

    return response.data.data.unopenedCards.items
  }

  async moveCardToStage ({ cardId, afterStageId, beforeStageId, nextCardId }) {
    const response = await client.post('', {
      operationName: 'MoveCardAxisX',
      variables: {
        moveCardToStageArgs: {
          cardId,
          afterStageId,
          beforeStageId,
          nextCardId
        }
      },
      query: `#graphql
        mutation MoveCardAxisX($moveCardToStageArgs: MoveCardToStageInput!) {
          moveCardToStage(moveCardToStageArgs: $moveCardToStageArgs) {
            id
            __typename
          }
        }
      `
    })

    return response.data.data
  }

  async createCardComment ({ cardId, content }) {
    const response = await client.post('', {
      operationName: 'CreateCardComment',
      variables: {
        input: {
          cardId,
          content
        }
      },
      query: `#graphql
        mutation CreateCardComment($input: CreateCardCommentInput!) {
          createCardComment(input: $input) {
            id
            __typename
          }
        }
      `
    })

    return response.data.data.createCardComment
  }

  async getCardFields ({ cardId }) {
    const response = await client.post('', {
      operationName: 'GetStartFormFields',
      variables: {
        cardId
      },
      query: `#graphql
        query GetStartFormFields($cardId: ID!) {
          card(id: $cardId) {
            fields {
              id
              type
              title
              value
            }
          }
        }
      `
    })

    return response.data.data.card.fields
  }

  async archiveCard ({ cardId }) {
    const response = await client.post('', {
      operationName: 'ArchiveCard',
      variables: {
        id: cardId
      },
      query: `#graphql
        mutation ArchiveCard($id: ID!) {
          archiveCard(id: $id) {
            id
            __typename
          }
        }
      `
    })

    return response.data.data.archiveCard
  }

  async getPipe ({ pipeId }) {
    console.log('Fetching pipe with ID:', pipeId)
    const response = await client.post('', {
      operationName: 'GetPipe',
      variables: {
        pipeId
      },
      query: `#graphql
        query GetPipe($pipeId: ID!) {
          pipe(pipeId: $pipeId) {
            id
            name
            stages {
              id
              name
            }
          }
        }
      `
    })

    return response.data.data.pipe
  }
}

export const fluxClient = new FluxClient()
