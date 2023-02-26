const { writeFile } = require('node:fs/promises')
const { mkdir } = require('node:fs/promises')
const { readFile } = require('node:fs/promises')
const { dirname } = require('node:path')
const { join } = require('node:path')
const { $ } = require('./exec.js')
const os = require('node:os')

const HOME_DIR_NAME = os.homedir()
const LAST_UPDATE_FILE_PATH = join(HOME_DIR_NAME, '.fc-tools/data/last-update.txt')
const LAST_UPDATE_FOLDER_PATH = dirname(LAST_UPDATE_FILE_PATH)
const TODAY = new Date().toISOString().split('T')[0]

async function isUpdateCheckedToday () {
  return readFile(LAST_UPDATE_FILE_PATH, { encoding: 'utf8' })
    .then((content) => content.trim())
    .catch(() => null)
    .then((lastUpdateCheck) => lastUpdateCheck === TODAY)
}

async function markUpdateAsCheckedToday () {
  await mkdir(LAST_UPDATE_FOLDER_PATH, { recursive: true })
  await writeFile(LAST_UPDATE_FILE_PATH, TODAY)
}

async function checkUpdate () {
  if (await isUpdateCheckedToday()) return
  await markUpdateAsCheckedToday()

  const currentSha = await getCurrentSha()
  const latestSha = await getLatestSha()

  if (currentSha === latestSha) return

  console.warn('There is a new version available.')
  console.warn("Please run 'field-update' to update.")
}

async function getCurrentSha () {
  return $('git rev-parse HEAD')
}

async function getLatestSha () {
  await $('git fetch')
  const lsRemoveStdout = await $('git ls-remote')
  return lsRemoveStdout.split('\n')
    .find(line => line.includes('refs/heads/master'))
    .split('\t')
    .shift()
}

module.exports = {
  checkUpdate,
  getCurrentSha,
  getLatestSha
}
