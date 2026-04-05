import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: resolve(__dirname, '..'),
  transpilePackages: ['fc-tools'],
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    externalDir: true
  },
  webpack: (config) => {
    config.resolve.modules.unshift(resolve(__dirname, 'node_modules'))
    return config
  }
}

export default nextConfig
