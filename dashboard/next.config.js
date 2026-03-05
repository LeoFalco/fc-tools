import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: resolve(__dirname, '..'),
  transpilePackages: ['fc-tools'],
  experimental: {
    externalDir: true
  }
}

export default nextConfig
