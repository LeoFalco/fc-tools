// @ts-check

import { execaCommand as exec } from 'execa'
import ora from 'ora'

/**
 * @param {string} command
 * @param {Object} [options] - options
 * @param {boolean} [options.reject] - reject promise on error (default: true)
 * @param {string} [options.returnProperty] - stdout | stderr
 * @param { 'pipe'| 'inherit' | 'ignore' | 'overlapped' } [options.stdio] - stdio option for execa (default: pipe)
 * @returns {Promise<string>}
 */
export async function $ (command, options) {
  options = options || {}
  options.reject = typeof options.reject === 'boolean' ? options.reject : true
  options.returnProperty = options.returnProperty || 'stdout'

  const spinner = ora()
  spinner.text = command
  spinner.start()

  const result = await exec(command, {
    cleanup: true,
    reject: options.reject,
    stdio: options.stdio || 'pipe'
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

export function $stream (command, options) {
  options = options || {}
  options.reject = typeof options.reject === 'boolean' ? options.reject : true
  options.returnProperty = options.returnProperty || 'stdout'

  return exec(command, {
    cleanup: true,
    reject: options.reject
  })
}
