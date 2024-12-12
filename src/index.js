import { $ } from './core/exec.js'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

async function run () {
  const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))

  console.log('Current directory:', CURRENT_DIR)

  await $(`node ${CURRENT_DIR}/src/update.js`, {
    stdio: 'inherit',
    loading: false
  })

  const args = process.argv.slice(2).join(' ')

  const exitCode = await $(`node --no-warnings ${CURRENT_DIR}/src/main.js ${args}`, {
    stdio: 'inherit',
    reject: false,
    returnProperty: 'exitCode',
    loading: false
  })

  process.exit(exitCode)
}

run()
