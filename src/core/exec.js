// @ts-check

import { execaCommand as exec } from 'execa'
import ora from 'ora'

/**
 * @param {string} command
 * @param {Object} [options] - options
 * @param {boolean} [options.reject] - reject promise on error (default: true)
 * @param {string} [options.returnProperty] - stdout | stderr
 * @returns {Promise<string>}
 */
export async function $ (command, options) {
  options = options || {}
  options.reject = typeof options.reject === 'boolean' ? options.reject : true
  options.returnProperty = options.returnProperty || 'stdout'

  const spinner = ora(command)
  spinner.start()

  const result = await exec(command, {
    cleanup: true,
    reject: options.reject
  })
    .then(result => {
      spinner.succeed()
      return result
    })
    .catch(err => {
      spinner.fail()
      throw err
    })

  const returnValue = result[options.returnProperty]

  if (typeof returnValue === 'string') {
    return returnValue.trim()
  }

  return returnValue
}
