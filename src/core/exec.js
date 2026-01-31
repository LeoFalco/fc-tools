// @ts-check

import { execaCommand as exec } from 'execa'
import ora from 'ora'

/**
 * @param {string} command
 * @param {Object} [options] - options
 * @param {boolean} [options.reject] - reject promise on error (default: true)
 * @param {string} [options.returnProperty] - stdout | stderr
 * @param {boolean} [options.loading] - loading spinner (default: true)
 * @param { 'pipe'| 'inherit' | 'ignore' | 'overlapped' } [options.stdio] - stdio option for execa (default: pipe)
 * @param {boolean} [options.json] - parse output as JSON (default: false)
 * @param {string} [options.cwd] - working directory (default: process.cwd())
 * @param {number} [options.timeout] - timeout in milliseconds
 * @param {AbortSignal} [options.signal] - abort signal
 * @returns {Promise<string | Object>} - command output
 */
export async function $ (command, options) {
  options = options || {}
  options.reject = typeof options.reject === 'boolean' ? options.reject : true
  options.returnProperty = options.returnProperty || 'stdout'
  options.loading = typeof options.loading === 'boolean' ? options.loading : true

  const spinner = options.loading
    ? ora({ text: command }).start()
    : null

  /** @type {any} */
  const execOptions = {
    cleanup: true,
    cwd: options.cwd,
    reject: options.reject,
    stdio: options.stdio || 'pipe',
    timeout: options.timeout, // Added support for timeout
    cancelSignal: options.signal // Added support for cancellation
  }

  const result = await exec(command, execOptions)
    .then(result => {
      spinner?.succeed()
      return result
    })
    .catch(err => {
      spinner?.fail()
      throw err
    })

  if (options.returnProperty === 'all') {
    return {
      exitCode: result.exitCode,
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr
    }
  }

  const returnValue = result[options.returnProperty]

  const returnValueAsString = typeof returnValue === 'string' ? returnValue.trim() : returnValue

  return options.json ? JSON.parse(returnValueAsString) : returnValueAsString
}
