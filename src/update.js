import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import inquirer from 'inquirer'
import { dirname, join } from 'path'

const CURRENT_DIR_NAME = dirname(fileURLToPath(import.meta.url))
const LAST_UPDATE_FILE_PATH = join(CURRENT_DIR_NAME, '../../data/last-update.txt')
const LAST_UPDATE_FOLDER_PATH = dirname(LAST_UPDATE_FILE_PATH)
const UPDATE_FILE_FULL_PATH = join(LAST_UPDATE_FOLDER_PATH, 'update-check.txt')

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

  if (!existsSync(UPDATE_FILE_FULL_PATH)) {
    return false
  }

  const lastUpdateCheck = readFileSync(UPDATE_FILE_FULL_PATH, {
    encoding: 'utf-8',
    flag: 'a+'
  })
  return today === lastUpdateCheck
}

function markUpdateCheckedToday () {
  const today = new Date().toISOString().split('T').shift()
  writeFileSync(UPDATE_FILE_FULL_PATH, today)
}

const currentFileName = fileURLToPath(import.meta.url)
const invokedFileName = process.argv[1]

if (currentFileName === invokedFileName) {
  checkUpdate()
}

export { checkUpdate }
