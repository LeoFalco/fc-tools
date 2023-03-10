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

  console.log(`${green('$')} ${result.escapedCommand}`)

  const returnValue = result[options.returnProperty]

  if (typeof returnValue === 'string') {
    return returnValue.trim()
  }

  return returnValue
}
