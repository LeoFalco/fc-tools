import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import inquirer from 'inquirer'

async function checkUpdate () {
  if (isUpdateCheckedToday()) return

  markUpdateCheckedToday()

  exec('git fetch origin master --quiet')

  const commitsBehindCount = parseInt(exec('git rev-list HEAD...origin/master --count')) || 0

  if (commitsBehindCount === 0) return

  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: 'Update available do you want to update to the latest version now?'
  }])

  if (!confirmed) {
    console.log('Update declined.')
    return
  }

  console.log('Updating...')

  try {
    exec('git reset --hard HEAD~1')
    exec('git pull origin master', { stdio: 'pipe' })
  } catch (error) {
    console.error(`Error on installing update\n${error.stderr.toString().trim()}`)

    console.log('Fatal error update aborted.')
    return
  }

  console.log('Update complete.')
}

function exec (command, options) {
  return execSync(command, options).toString().trim()
}

function isUpdateCheckedToday () {
  const today = new Date().toISOString().split('T').shift()

  if (!existsSync('update-check.txt')) {
    return false
  }

  const lastUpdateCheck = readFileSync('update-check.txt', {
    encoding: 'utf-8',
    flag: 'a+'
  })
  return today === lastUpdateCheck
}

function markUpdateCheckedToday () {
  const today = new Date().toISOString().split('T').shift()
  writeFileSync('update-check.txt', today)
}

const currentFileName = fileURLToPath(import.meta.url)
const invokedFileName = process.argv[1]

if (currentFileName === invokedFileName) {
  checkUpdate()
}

export { checkUpdate }
