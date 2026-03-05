/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['fc-tools'],
  experimental: {
    externalDir: true
  }
}

export default nextConfig
