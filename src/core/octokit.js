import dotEnv from 'dotenv'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Octokit } from 'octokit'

dotEnv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), '../../.env'),
  debug: false,
  quiet: true
})

function getToken () {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  return execSync('gh auth token').toString().trim()
}

export const octokit = new Octokit({
  auth: getToken()
})
