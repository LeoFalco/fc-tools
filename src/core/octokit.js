import dotEnv from 'dotenv'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Octokit } from 'octokit'

dotEnv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), '../../.env')
})

export const octokit = new Octokit({
  auth: execSync('gh auth token').toString().trim()
})
