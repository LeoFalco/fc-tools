import { execaCommand as exec } from 'execa'
export async function $ (command, returnProperty = 'stdout') {
  const result = await exec(command)

  if (!returnProperty) return result

  const returnValue = result[returnProperty]

  if (typeof returnValue === 'string') {
    return returnValue.trim()
  }

  return returnValue
}
