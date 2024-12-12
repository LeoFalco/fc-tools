import { $ } from './core/exec.js'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

async function run () {
  const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))

  await $(`node ${CURRENT_DIR}/update.js`, {
    stdio: 'inherit',
    loading: false
  })

  const args = process.argv.slice(2).join(' ')

  const exitCode = await $(`node --no-warnings ${CURRENT_DIR}/main.js ${args}`, {
    stdio: 'inherit',
    reject: false,
    returnProperty: 'exitCode',
    loading: false
  })

  process.exit(exitCode)
}

run()
