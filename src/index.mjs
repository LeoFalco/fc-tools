import { Command as Commander } from 'commander'
import { installCommands } from './commands/index.js'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkUpdate } from './core/check-update.js'

async function readPackageJSON () {
  const currentDirName = dirname(fileURLToPath(import.meta.url))
  const packageJSONPath = join(currentDirName, '../package.json')
  return JSON.parse(await readFile(packageJSONPath, { encoding: 'utf8' }))
}

async function createProgram () {
  const program = new Commander()
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

  console.log()
  program.parse()
}

run()
