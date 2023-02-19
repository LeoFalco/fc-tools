import { execaCommand as exec } from 'execa'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CURRENT_DIR_NAME = dirname(fileURLToPath(import.meta.url))
const LAST_UPDATE_FILE_PATH = join(CURRENT_DIR_NAME, `../../data/last-update.txt`)
const LAST_UPDATE_FOLDER_PATH = dirname(LAST_UPDATE_FILE_PATH)
const TODAY = new Date().toISOString().split('T')[0]

export async function checkUpdate () {
  if (await isUpdateCheckedToday()) return
  await markUpdateAsCheckedToday()

  const currentSha = await getCurrentSha()
  const latestSha = await getLatestSha()

  if (currentSha === latestSha) return

  console.log('WARN: There is a new version available.')

}

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

export async function getCurrentSha () {
  return exec('git rev-parse HEAD').then(({ stdout }) => stdout.trim())
}

export async function getLatestSha () {
  await exec('git fetch')
  return exec('git ls-remote').then(({ stdout }) => {
    return stdout.split('\n').find(line => line.includes('refs/heads/master')).split('\t')[0]
  })
}
