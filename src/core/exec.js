import { execaCommand as exec } from 'execa'

import chalk from 'chalk'

const green = chalk.green
const red = chalk.red

export async function $ (command, options) {
  options = options || {}
  options.reject = typeof options.reject === 'boolean' ? options.reject : true
  options.returnProperty = options.returnProperty || 'stdout'

  const result = await exec(command, {
    cleanup: true,
    reject: options.reject
  })
    .then(result => {
      console.log(`${green('$')} ${command}`)
      return result
    })
    .catch(err => {
      console.log(`${red('$')} ${command}`)
      throw err
    })

  const returnValue = result[options.returnProperty]

  if (typeof returnValue === 'string') {
    return returnValue.trim()
  }

  return returnValue
}
