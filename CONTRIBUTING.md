# Contributing to AI Unified

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Git

### Getting Started

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/ai-unified.git
   cd ai-unified
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Build all packages**

   ```bash
   pnpm build
   ```

4. **Run in development mode**
   ```bash
   pnpm dev
   ```

## Project Structure

```
ai-unified/
├── packages/           # All publishable packages
│   ├── core/          # Core types & utilities
│   ├── transport/     # HTTP & streaming
│   ├── keyring/       # Encryption
│   ├── storage/       # Database layer
│   ├── model-registry/
│   ├── observability/
│   ├── provider-*/    # Provider adapters
│   └── ui/            # React components (future)
├── examples/          # Example applications
└── docs/              # Documentation (future)
```

## Adding a New Provider

To add support for a new AI provider:

1. **Create a new package**

   ```bash
   mkdir -p packages/provider-yourprovider
   cd packages/provider-yourprovider
   ```

2. **Set up package.json**

   ```json
   {
     "name": "@aiu/provider-yourprovider",
     "version": "0.1.0",
     "type": "module",
     "dependencies": {
       "@aiu/core": "workspace:*",
       "@aiu/transport": "workspace:*"
     }
   }
   ```

3. **Implement ProviderAdapter**

   ```typescript
   // src/adapter.ts
   import type { ProviderAdapter, ProviderInfo, ModelInfo } from '@aiu/core';
   import { HttpClient } from '@aiu/transport';

   export class YourProviderAdapter implements ProviderAdapter {
     private http: HttpClient;

     constructor() {
       this.http = new HttpClient();
     }

     info(): ProviderInfo {
       return {
         id: 'yourprovider',
         name: 'Your Provider',
         supports: ['chat', 'embed'],
         endpoints: {
           chat: '/v1/chat',
           embed: '/v1/embed',
         },
       };
     }

     async validateApiKey(key: string) {
       // Validate key with provider API
       // ...
     }

     async listModels(key: string): Promise<ModelInfo[]> {
       // Fetch models from provider
       // ...
     }

     async chat(req: ChatRequest, key: string) {
       // Implement chat completion
       // ...
     }

     async embed(req: EmbedRequest, key: string) {
       // Implement embeddings
       // ...
     }
   }
   ```

4. **Add tests** (coming soon)

5. **Update documentation**

## Code Style

- **TypeScript**: All code must be TypeScript
- **Formatting**: Use Prettier (run `pnpm format`)
- **Linting**: Follow ESLint rules (run `pnpm lint`)
- **Types**: Export all public types from package index

### Naming Conventions

- **Files**: kebab-case (`model-registry.ts`)
- **Classes**: PascalCase (`ModelRegistry`)
- **Functions/variables**: camelCase (`getModels`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces/Types**: PascalCase (`ProviderInfo`)

## Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/core
pnpm test
```

## Commits

Follow conventional commits:

```
feat: add support for Mistral AI provider
fix: handle rate limit errors in transport
docs: update README with new examples
chore: upgrade dependencies
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Pull Requests

1. **Create a feature branch**

   ```bash
   git checkout -b feat/add-mistral-provider
   ```

2. **Make your changes**

   - Write clean, documented code
   - Add tests where applicable
   - Update documentation

3. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add Mistral AI provider adapter"
   ```

4. **Push and create PR**
   ```bash
   git push origin feat/add-mistral-provider
   ```

### PR Checklist

- [ ] Code builds without errors (`pnpm build`)
- [ ] All tests pass (`pnpm test`)
- [ ] Types are correct (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Documentation updated (if applicable)
- [ ] Examples added/updated (if applicable)

## Release Process

Releases are managed by maintainers using changesets:

```bash
pnpm changeset
pnpm changeset version
pnpm build
pnpm release
```

## Security

If you discover a security vulnerability, please email security@ai-unified.dev instead of opening a public issue.

## Questions?

- Open an issue for bugs or feature requests
- Discussions for questions and ideas
- Join our Discord (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
