import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
export async function readPackageJSON () {
  const currentDirName = dirname(fileURLToPath(import.meta.url))
  const packageJSONPath = join(currentDirName, '../../package.json')
  return JSON.parse(await readFile(packageJSONPath, { encoding: 'utf8' }))
}
