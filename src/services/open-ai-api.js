import { Configuration, OpenAIApi } from 'openai'

console.log('process.env.OPENAI_ORG', process.env.OPENAI_ORG)
console.log('process.env.OPENAI_TOKEN', process.env.OPENAI_TOKEN)

const openAIApi = new OpenAIApi(new Configuration({
  organization: process.env.OPENAI_ORG,
  apiKey: process.env.OPENAI_TOKEN
}))

export async function generateFieldNewsSuggestion ({ repoDescription, implementation }) {
  const prompt = `
      Comunique um e-mail descolado de uma alteração no código com descrição que deve ser explicativa para o público em geral.

      Será enviado para funcionários internos da empresa Field Control.
      Onde usamos "Fielders" para nos referirmos aos funcionários da empresa.

      Deve possuir os seguintes tópicos separados:

      Tópico "**Contexto**", onde o contexto é:
      Como "${implementation}" afeta "${repoDescription}".

      Tópico "**Motivações**", liste as motivações para essas implementações:
      "${implementation}"

      Tópico "**Implementação**", onde as implementações são:
      (melhore esse texto: "${implementation}")

      E adicione um último tópico "Evoluções" apresentando as evoluções que essas implementações implicam.

      Importante: O texto gerado não deve conter tabulações.
      <END>
    `
  const response = await openAIApi.createCompletion({
    prompt,
    model: 'text-davinci-003',
    temperature: 1,
    max_tokens: 3024,
    stop: '<END>'
  })

  return response.data.choices[0].text.trim()
}
