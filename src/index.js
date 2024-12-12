import { $ } from './core/exec.js'

async function run () {
  await $('node src/update.js', {
    stdio: 'inherit',
    loading: false
  })

  const args = process.argv.slice(2).join(' ')

  const exitCode = await $(`node src/main.js ${args}`, {
    stdio: 'inherit',
    reject: false,
    returnProperty: 'exitCode',
    loading: false
  })

  process.exit(exitCode)
}

run()
