/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@aiu/core', '@aiu/agents', '@aiu/ui', '@aiu/observability'],
}

module.exports = nextConfig
