import { execaCommand as exec } from 'execa'

import chalk from 'chalk'

const green = chalk.green
export async function $ (command, options) {
  options = options || {}
  options.reject = typeof options.reject === 'boolean' ? options.reject : true
  options.returnProperty = options.returnProperty || 'stdout'

  const result = await exec(command, {
    cleanup: true,
    reject: options.reject
  })
    .then(result => {
      console.log(`${green('$')} ${result.escapedCommand}`)
      return result
    })
    .catch(err => {
      console.log('err', err)
      throw err
    })

  const returnValue = result[options.returnProperty]

  if (typeof returnValue === 'string') {
    return returnValue.trim()
  }

  return returnValue
}
