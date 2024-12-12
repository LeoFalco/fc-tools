import { $ } from './core/exec.js'

async function run () {
  await $('node src/update.js', {
    stdio: 'inherit'
  })

  const exitCode = await $('node src/main.js', {
    stdio: 'inherit',
    reject: false,
    returnProperty: 'exitCode'
  })

  process.exit(exitCode)
}

run()
