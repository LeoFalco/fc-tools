import { execaCommand as exec } from 'execa'
export async function $ (command, options) {
  options = options || {}
  options.reject = options.reject || undefined
  options.returnProperty = options.returnProperty || 'stdout'

  const result = await exec(command, {
    cleanup: true,
    reject: options.reject
  })

  const returnValue = result[options.returnProperty]

  if (typeof returnValue === 'string') {
    return returnValue.trim()
  }

  return returnValue
}
