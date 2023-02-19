import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readdir } from 'node:fs/promises'

export async function installCommands ({ program }) {
  const currentFileName = fileURLToPath(import.meta.url)

  const currentDirName = dirname(currentFileName)

  const currentSubDirNames = await readdir(currentDirName)
    .then((names) => names.filter((name) => name !== 'index.js'))

  for (const currentSubDirName of currentSubDirNames) {
    const currentSubDirPath = `${currentDirName}/${currentSubDirName}/index.js`

    try {
      const currentSubDirModule = await import(currentSubDirPath).then((module) => module.default)
      if (!currentSubDirModule.install) {
        console.warn(`WARN: Module '${currentSubDirName}' at '${currentSubDirPath}' does not export 'install' function`)
        continue
      }

      await currentSubDirModule.install({ program })
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        console.warn(`WARN: file '${currentSubDirPath}' not exports a module`)
        continue
      }

      throw err
    }
  }
}
