# AI Unified

A unified TypeScript framework for working with multiple AI providers through a single, consistent interface.

## 🚀 Features

- **Multi-Provider Support**: OpenAI, Anthropic, Google, Azure, Cohere, Ollama, Mistral, Stability AI, ElevenLabs, AssemblyAI, Jina AI, OpenRouter, vLLM
- **Unified API**: Single interface for chat, embeddings, image generation, audio transcription/synthesis, and reranking
- **Type-Safe**: Full TypeScript support with strict typing
- **Streaming**: Native support for streaming responses
- **Model Registry**: Centralized model management with metadata
- **Secure Keyring**: Encrypted API key storage with AES-256-GCM
- **Headless UI Components**: React components for building AI interfaces
- **Autonomous Agents**: Support for coding agents (Aider, GitHub Copilot)

## 📦 Packages

### Core Packages
- **[@aiu/core](./packages/core)** - Core types and interfaces
- **[@aiu/transport](./packages/transport)** - HTTP client with retry logic and streaming
- **[@aiu/keyring](./packages/keyring)** - Secure API key management
- **[@aiu/model-registry](./packages/model-registry)** - Centralized model metadata
- **[@aiu/storage](./packages/storage)** - Key-value storage abstraction
- **[@aiu/observability](./packages/observability)** - Logging and monitoring

### Provider Adapters
- **[@aiu/provider-openai](./packages/provider-openai)** - OpenAI integration
- **[@aiu/provider-anthropic](./packages/provider-anthropic)** - Anthropic integration
- **[@aiu/provider-google](./packages/provider-google)** - Google AI integration
- **[@aiu/provider-azure](./packages/provider-azure)** - Azure OpenAI integration
- **[@aiu/provider-cohere](./packages/provider-cohere)** - Cohere integration
- **[@aiu/provider-ollama](./packages/provider-ollama)** - Ollama integration
- **[@aiu/provider-mistral](./packages/provider-mistral)** - Mistral AI integration
- **[@aiu/provider-stability](./packages/provider-stability)** - Stability AI integration
- **[@aiu/provider-elevenlabs](./packages/provider-elevenlabs)** - ElevenLabs integration
- **[@aiu/provider-assemblyai](./packages/provider-assemblyai)** - AssemblyAI integration
- **[@aiu/provider-jina](./packages/provider-jina)** - Jina AI integration
- **[@aiu/provider-openrouter](./packages/provider-openrouter)** - OpenRouter integration
- **[@aiu/provider-vllm](./packages/provider-vllm)** - vLLM integration

### UI & Tools
- **[@aiu/ui](./packages/ui)** - Headless React components
- **[@aiu/sdk](./packages/sdk)** - High-level SDK
- **[@aiu/cli](./packages/cli)** - Command-line interface

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Applications & Examples         │
│  (CLI, SDK, UI Showcase, Custom Apps)  │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         High-Level Abstractions         │
│   (SDK, UI Components, Agent Layer)    │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│          Core Infrastructure            │
│  (Model Registry, Keyring, Storage)    │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         Provider Adapters (13+)         │
│  (OpenAI, Anthropic, Google, etc.)     │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│    Transport & Observability Layer      │
│   (HTTP Client, Logging, Monitoring)   │
└─────────────────────────────────────────┘
```

## 🚦 Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Basic Usage

```typescript
import { OpenAIAdapter } from '@aiu/provider-openai';

const adapter = new OpenAIAdapter();

// Chat completion
const response = await adapter.chat({
  model: 'gpt-4',
  input: [
    { role: 'user', content: 'Hello!' }
  ],
  options: { temperature: 0.7 }
}, 'your-api-key');

console.log(response.output.content);
```

### Using the SDK

```typescript
import { SDK } from '@aiu/sdk';

const sdk = new SDK();

// Register providers
sdk.registerProvider('openai', new OpenAIAdapter());

// Add API key
await sdk.keyring.store('openai', 'your-key', 'default');

// Chat with any model
const response = await sdk.chat('openai:gpt-4', [
  { role: 'user', content: 'Explain quantum computing' }
]);
```

### UI Components

```tsx
import { ModelForm, KeyringManager } from '@aiu/ui';

function MyApp() {
  return (
    <ModelForm
      availableProviders={providers}
      onProviderSelect={fetchModels}
      onSave={saveModel}
    >
      {({ formData, handleProviderChange }) => (
        // Your custom UI
      )}
    </ModelForm>
  );
}
```

## 📚 Examples

### [UI Showcase](./examples/ui-showcase)
Complete Next.js application demonstrating all UI components:
- Chat interface with streaming
- Model registry with dynamic fetching
- Keyring management
- Agent integration

### [Basic Chat](./examples/basic-chat)
Simple chat application using the SDK.

## 🔑 Keyring Management

Secure API key storage with encryption:

```typescript
import { KeyringManager } from '@aiu/keyring';

const keyring = new KeyringManager();

// Store encrypted key
await keyring.store('openai', 'sk-...', 'production');

// Retrieve key
const key = await keyring.retrieve('openai', 'production');

// List all keys
const keys = await keyring.list();

// Validate key
const isValid = await keyring.validate('openai', 'production');
```

## 🎨 UI Components

Headless React components for building AI interfaces:

- **ModelForm** - Add/edit models with dynamic provider fetching
- **ModelSelect** - Filter and select models
- **KeyringManager** - Manage API keys
- **ProviderSelector** - Select providers with key validation
- **StreamingOutput** - Display streaming responses
- **AgentSelector** - Select coding agents
- **AgentEventStream** - Monitor agent execution

## 🛠️ Development

### Project Structure

```
ai-unified/
├── packages/          # Core packages and providers
│   ├── core/         # Type definitions
│   ├── transport/    # HTTP client
│   ├── keyring/      # Key management
│   ├── ui/           # React components
│   └── provider-*/   # Provider adapters
├── examples/         # Example applications
│   ├── ui-showcase/  # Next.js demo
│   └── basic-chat/   # Simple chat
├── docs/             # Documentation
└── scripts/          # Build scripts
```

### Build Commands

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @aiu/core build

# Watch mode
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### Adding a New Provider

1. Create package in `packages/provider-{name}/`
2. Implement `ProviderAdapter` interface
3. Add to SDK provider registry
4. Update documentation

## 📖 Documentation

- [Architecture Guide](./docs/architecture.md)
- [API Reference](./docs/api-reference.md)
- [Provider Development](./docs/provider-development.md)
- [UI Components](./docs/ui-components.md)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Coverage report
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `pnpm build` and `pnpm test`
6. Submit a pull request

## 📝 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI, Anthropic, Google, and other provider teams
- TypeScript and React communities
- All contributors to this project

## 📞 Support

- 📧 Email: support@gosec.cloud
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/ai-unified/issues)

---

**Built with ❤️ by the AI Unified team**
