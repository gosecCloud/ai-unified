/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@aiu/core',
    '@aiu/ui',
    '@aiu/sdk',
    '@aiu/keyring',
    '@aiu/storage',
    '@aiu/observability',
    '@aiu/model-registry',
    '@aiu/agents',
    '@aiu/provider-anthropic',
    '@aiu/provider-openai'
  ],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'pino']
  }
};

module.exports = nextConfig;
