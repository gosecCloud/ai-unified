# Installation Guide

## Install from GitHub

AI Unified is a monorepo containing multiple packages. You can install packages directly from GitHub.

### Prerequisites

```bash
# Ensure you have pnpm installed
npm install -g pnpm
```

### Install Individual Packages

Install specific packages from the GitHub repository:

```bash
# Install core package
npm install github:gosecCloud/ai-unified#workspace=packages/core

# Install UI components
npm install github:gosecCloud/ai-unified#workspace=packages/ui

# Install SDK
npm install github:gosecCloud/ai-unified#workspace=packages/sdk

# Install CLI
npm install -g github:gosecCloud/ai-unified#workspace=packages/cli

# Install provider adapters
npm install github:gosecCloud/ai-unified#workspace=packages/provider-openai
npm install github:gosecCloud/ai-unified#workspace=packages/provider-anthropic
npm install github:gosecCloud/ai-unified#workspace=packages/provider-google
# ... and so on for other providers
```

### Install Multiple Packages

For a typical project using the SDK and UI:

```bash
npm install \
  github:gosecCloud/ai-unified#workspace=packages/core \
  github:gosecCloud/ai-unified#workspace=packages/sdk \
  github:gosecCloud/ai-unified#workspace=packages/ui \
  github:gosecCloud/ai-unified#workspace=packages/provider-openai \
  github:gosecCloud/ai-unified#workspace=packages/provider-anthropic
```

### Package.json Configuration

Add to your `package.json`:

```json
{
  "dependencies": {
    "@aiu/core": "github:gosecCloud/ai-unified#workspace=packages/core",
    "@aiu/sdk": "github:gosecCloud/ai-unified#workspace=packages/sdk",
    "@aiu/ui": "github:gosecCloud/ai-unified#workspace=packages/ui",
    "@aiu/provider-openai": "github:gosecCloud/ai-unified#workspace=packages/provider-openai",
    "@aiu/provider-anthropic": "github:gosecCloud/ai-unified#workspace=packages/provider-anthropic"
  }
}
```

Then run:

```bash
npm install
# or
pnpm install
# or
yarn install
```

### Using with pnpm

If your project uses pnpm workspaces:

```bash
pnpm add github:gosecCloud/ai-unified#workspace=packages/core
pnpm add github:gosecCloud/ai-unified#workspace=packages/sdk
```

### Using with Yarn

```bash
yarn add github:gosecCloud/ai-unified#workspace=packages/core
yarn add github:gosecCloud/ai-unified#workspace=packages/sdk
```

## Available Packages

### Core Infrastructure
- `packages/core` - Core types and interfaces
- `packages/transport` - HTTP client with retry logic
- `packages/keyring` - Secure API key management
- `packages/model-registry` - Model metadata management
- `packages/storage` - Database abstractions
- `packages/observability` - Logging and monitoring

### Provider Adapters
- `packages/provider-openai` - OpenAI
- `packages/provider-anthropic` - Anthropic
- `packages/provider-google` - Google AI
- `packages/provider-azure` - Azure OpenAI
- `packages/provider-cohere` - Cohere
- `packages/provider-ollama` - Ollama
- `packages/provider-mistral` - Mistral AI
- `packages/provider-stability` - Stability AI
- `packages/provider-elevenlabs` - ElevenLabs
- `packages/provider-assemblyai` - AssemblyAI
- `packages/provider-jina` - Jina AI
- `packages/provider-openrouter` - OpenRouter
- `packages/provider-vllm` - vLLM

### High-Level Tools
- `packages/sdk` - High-level SDK
- `packages/ui` - React UI components
- `packages/cli` - Command-line interface
- `packages/agents` - Autonomous coding agents

## Quick Start After Installation

```typescript
// Install: npm install github:gosecCloud/ai-unified#workspace=packages/sdk
import { SDK } from '@aiu/sdk';
import { OpenAIAdapter } from '@aiu/provider-openai';

const sdk = new SDK();
sdk.registerProvider('openai', new OpenAIAdapter());

await sdk.keyring.store('openai', 'your-api-key', 'default');

const response = await sdk.chat('openai:gpt-4', [
  { role: 'user', content: 'Hello!' }
]);

console.log(response.output.content);
```

## Development Installation

To contribute or develop locally:

```bash
# Clone repository
git clone https://github.com/gosecCloud/ai-unified.git
cd ai-unified

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Version Pinning

To pin to a specific commit or tag:

```bash
# Pin to specific commit
npm install github:gosecCloud/ai-unified#abc1234#workspace=packages/core

# Pin to tag/release
npm install github:gosecCloud/ai-unified#v1.0.0#workspace=packages/core
```

## Troubleshooting

### Authentication Issues

If you need authentication to access the repository:

```bash
# Use SSH URL instead
npm install git+ssh://git@github.com:gosecCloud/ai-unified.git#workspace=packages/core
```

### Workspace Not Found

Ensure you're using the correct workspace path. All packages are under `packages/`:
- ✅ `#workspace=packages/core`
- ❌ `#workspace=core`

### Peer Dependencies

Some packages may require peer dependencies. Install them separately:

```bash
# For UI components
npm install react react-dom

# For specific providers
npm install node-fetch  # if needed
```

## Support

- 📚 Documentation: [README.md](./README.md)
- 🐛 Issues: [GitHub Issues](https://github.com/gosecCloud/ai-unified/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/gosecCloud/ai-unified/discussions)
