const { readdir } = require('node:fs/promises')

async function installCommands ({ program }) {
  const currentDirName = __dirname

  const currentSubDirNames = await readdir(currentDirName)
    .then((names) => names.filter((name) => name !== 'index.js'))

  for (const currentSubDirName of currentSubDirNames) {
    const currentSubDirPath = `${currentDirName}/${currentSubDirName}/index.js`

    try {
      const currentSubDirModule = require(currentSubDirPath)
      if (!currentSubDirModule.install) {
        console.warn(`Module '${currentSubDirName}' at '${currentSubDirPath}' does not export 'install' function`)
        continue
      }

      await currentSubDirModule.install({ program })
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        console.warn(`file '${currentSubDirPath}' not exports a module`)
        continue
      }
      throw err
    }
  }
}

module.exports = {
  installCommands
}
