require('./core/patch-console-log.js')

const { program } = require('commander')
const { installCommands } = require('./commands/index.js')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')
const { checkUpdate } = require('./core/check-update.js')

async function readPackageJSON () {
  const packageJSONPath = join(__dirname, '../package.json')
  return JSON.parse(await readFile(packageJSONPath, { encoding: 'utf8' }))
}

async function createProgram () {
  const packageJSON = await readPackageJSON()

  return program
    .name(packageJSON.name)
    .version(packageJSON.version)
    .description(packageJSON.description)
}

async function run () {
  await checkUpdate()
  const program = await createProgram()
  await installCommands({ program })
  await program.parseAsync()
}

run()
