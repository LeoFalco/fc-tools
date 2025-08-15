import axios from 'axios'

const client = axios.create({
  baseURL: 'https://isengard.fluxcontrol.com.br/api/graphql',
  headers: {
    'Content-Type': 'application/json'
  }
})

client.interceptors.request.use((config) => {
  config.headers.Authorization = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImIyZTA2OTEwLWY1MDctNDIyOC1iMzEzLWJlYjlhYzljZGMwMyIsImFjY291bnRfaWQiOiJmNGQyZDdmMy05OGIyLTRhNWQtOTg1Zi0xZjZjMThkM2JkZWUiLCJuYW1lIjoiTGVvIEZhbGNvIiwiZW1haWwiOiJsZW9uYXJkb0BmaWVsZGNvbnRyb2wuY29tLmJyIiwiZW1haWxfdmFsaWRhdGVkX2F0IjpudWxsLCJsYXN0X3NlZW5fYXQiOm51bGwsImxhbmd1YWdlIjoicHQtQlIiLCJjcmVhdGVkX2F0IjoiMjAyNC0wOC0zMVQxOToyMzo1OC4wNzdaIiwidXBkYXRlZF9hdCI6IjIwMjQtMDgtMzFUMTk6MjM6NTguMDc3WiIsImF2YXRhcl91cmwiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NKQkJTeTJ2dTFkRjI5LUhmRmRSU1RPYTY2RUFvLWl0eDV5U2RnbW51SHlhWFF2Z0RrPXM5Ni1jIiwiaXNfb3duZXIiOmZhbHNlLCJkZWxldGVkX2F0IjpudWxsLCJlbWFpbF9jb21tdW5pY2F0aW9uX2Rpc2FibGVkIjpmYWxzZSwiaWF0IjoxNzU1MTc0MTI3LCJleHAiOjE3NTU0MzMzMjcsImF1ZCI6ImF1ZDpjbGllbnQiLCJpc3MiOiJodHRwczovL2lzZW5nYXJkLmZsdXhjb250cm9sLmNvbS5iciJ9.JqlhDeWuougTIcocfCxZoDYqk48U8u_POhm30i2pNmg'
  return config
})

class FluxClient {
  /**
   *
   * @param {Object} params
   * @param {string} params.stageId - ID of the stage to fetch cards from
   * @param {number} [params.take] - Number of items to fetch (default: 10)
   * @param {number} [params.skip] - Number of items to skip (default: 0)
   * @returns {Promise<{ items: Array, totalCount: number, pageInfo: { hasNextPage: boolean, hasPreviousPage: boolean } }>}
   * @description Fetches unopened cards from a specific stage in Flux.
   * @returns
   */
  async getUnopenedCards ({ stageId, skip = 0, take = 10 }) {
    const response = await client.post('', {
      operationName: 'GetUnopenedCards',
      variables: {
        stageId,
        take,
        sort: { field: 'index', order: 'asc' },
        skip,
        where: {
          archived: false
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

    return response.data.data.unopenedCards
  }
}

export const fluxClient = new FluxClient()
