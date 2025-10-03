# Quick Start Guide

Get started with AI Unified in 5 minutes.

## Prerequisites

- Node.js 18+
- pnpm 8+
- OpenAI or Anthropic API key

## Installation

```bash
git clone <repo-url>
cd ai-unified
pnpm install
pnpm build
```

## 1. Set Up Database (Optional)

For basic usage, you can skip this. For production with persistence:

```bash
cd packages/storage

# PostgreSQL
echo 'DATABASE_URL="postgresql://localhost:5432/ai_unified"' > .env
pnpm db:push

# OR SQLite (for development)
echo 'DATABASE_URL="file:./dev.db"' > .env
pnpm db:push

cd ../..
```

## 2. Run the Example

```bash
cd examples/basic-chat
cp .env.example .env

# Edit .env and add your API key:
# OPENAI_API_KEY=sk-...
# or
# ANTHROPIC_API_KEY=sk-ant-...

pnpm dev
```

You should see:

```
🤖 AI Unified - Basic Chat Example
🔐 Initializing keyring...
✅ OpenAI key stored
📦 Registering providers...
OpenAI key validation: valid=true
OpenAI models discovered: count=50+

💬 Testing OpenAI chat...
📝 Response: Quantum entanglement is when two particles...

✨ Example completed
```

## 3. Build Your First App

Create a new file `my-app.ts`:

```typescript
import { Keyring } from '@aiu/keyring';
import { OpenAIAdapter } from '@aiu/provider-openai';

async function main() {
  // 1. Setup keyring
  const masterKey = Keyring.generateMasterKey();
  const keyring = new Keyring({ masterKey });

  // 2. Store your API key (encrypted)
  keyring.save({
    providerId: 'openai',
    alias: 'default',
    key: process.env.OPENAI_API_KEY!,
  });

  // 3. Create provider adapter
  const openai = new OpenAIAdapter();

  // 4. Make a chat request
  const response = await openai.chat(
    {
      model: 'gpt-4o-mini',
      input: [{ role: 'user', content: 'What is TypeScript?' }],
      options: { temperature: 0.7 },
    },
    keyring.get('openai', 'default')
  );

  console.log(response.output.content);
}

main();
```

Run it:

```bash
pnpm tsx my-app.ts
```

## 4. Try Streaming

```typescript
import { OpenAIAdapter } from '@aiu/provider-openai';
import { Keyring } from '@aiu/keyring';

const keyring = new Keyring({ masterKey: Keyring.generateMasterKey() });
keyring.save({ providerId: 'openai', alias: 'default', key: process.env.OPENAI_API_KEY! });

const openai = new OpenAIAdapter();

const stream = await openai.chat(
  {
    model: 'gpt-4o-mini',
    input: [{ role: 'user', content: 'Count from 1 to 10.' }],
    options: { stream: true },
  },
  keyring.get('openai', 'default')
);

for await (const chunk of stream) {
  if (chunk.delta.content) {
    process.stdout.write(chunk.delta.content);
  }
}
```

## 5. Use Multiple Providers

```typescript
import { Keyring } from '@aiu/keyring';
import { OpenAIAdapter } from '@aiu/provider-openai';
import { AnthropicAdapter } from '@aiu/provider-anthropic';

const keyring = new Keyring({ masterKey: Keyring.generateMasterKey() });

// Store both keys
keyring.save({ providerId: 'openai', alias: 'default', key: process.env.OPENAI_API_KEY! });
keyring.save({ providerId: 'anthropic', alias: 'default', key: process.env.ANTHROPIC_API_KEY! });

// Create adapters
const openai = new OpenAIAdapter();
const anthropic = new AnthropicAdapter();

// Use OpenAI
const gptResponse = await openai.chat(
  {
    model: 'gpt-4o-mini',
    input: [{ role: 'user', content: 'Hello from OpenAI!' }],
  },
  keyring.get('openai', 'default')
);

// Use Anthropic
const claudeResponse = await anthropic.chat(
  {
    model: 'claude-3-5-haiku-20241022',
    input: [{ role: 'user', content: 'Hello from Claude!' }],
  },
  keyring.get('anthropic', 'default')
);

console.log('OpenAI:', gptResponse.output.content);
console.log('Claude:', claudeResponse.output.content);
```

## 6. Add Model Discovery

```typescript
import { ModelRegistry } from '@aiu/model-registry';
import { OpenAIAdapter } from '@aiu/provider-openai';
import { Keyring } from '@aiu/keyring';

const keyring = new Keyring({ masterKey: Keyring.generateMasterKey() });
keyring.save({ providerId: 'openai', alias: 'default', key: process.env.OPENAI_API_KEY! });

const registry = new ModelRegistry();
const openai = new OpenAIAdapter();
registry.registerProvider(openai);

// Refresh models from API
await registry.refresh('openai', keyring.get('openai', 'default'));

// Find all chat models with >100k context
const models = await registry.find({
  kind: 'chat',
  minContext: 100000,
  excludeDeprecated: true,
});

console.log('Available models:', models.map((m) => m.modelId));
```

## 7. Add Logging & Metrics

```typescript
import { createLogger, defaultMetrics } from '@aiu/observability';
import { OpenAIAdapter } from '@aiu/provider-openai';

const logger = createLogger({ level: 'info', pretty: true });

logger.info('Starting chat request...');

const start = Date.now();
const response = await openai.chat(request, apiKey);
const latency = Date.now() - start;

logger.info({ latency, tokens: response.usage?.totalTokens }, 'Request completed');

// Record metrics
defaultMetrics.increment('ai.requests.total', 1, { provider: 'openai', status: 'success' });
defaultMetrics.histogram('ai.request.latency', latency, { provider: 'openai' });

// View stats
const stats = defaultMetrics.getHistogramStats('ai.request.latency');
console.log('Avg latency:', stats.mean);
console.log('P95 latency:', stats.p95);
```

## 8. Persist to Database

```typescript
import { getPrismaClient, PrismaApiKeyRepository, PrismaModelRepository } from '@aiu/storage';

const prisma = getPrismaClient();
const apiKeyRepo = new PrismaApiKeyRepository(prisma);
const modelRepo = new PrismaModelRepository(prisma);

// Save encrypted key to DB
await apiKeyRepo.save({
  providerId: 'openai',
  alias: 'production',
  keyCiphertext: keyring.export()[0].keyCiphertext,
  status: 'active',
  createdAt: new Date(),
});

// Save models to DB
await modelRepo.saveMany(models);

// Query from DB
const savedModels = await modelRepo.list('openai', 'chat');
console.log('Models in DB:', savedModels.length);
```

## Common Patterns

### Pattern 1: Simple Chat

```typescript
import { OpenAIAdapter } from '@aiu/provider-openai';

const openai = new OpenAIAdapter();
const response = await openai.chat(
  {
    model: 'gpt-4o-mini',
    input: [{ role: 'user', content: 'Your question' }],
  },
  apiKey
);
console.log(response.output.content);
```

### Pattern 2: Streaming Chat

```typescript
const stream = await openai.chat(
  {
    model: 'gpt-4o-mini',
    input: messages,
    options: { stream: true },
  },
  apiKey
);

for await (const chunk of stream) {
  process.stdout.write(chunk.delta.content || '');
}
```

### Pattern 3: Embeddings

```typescript
const embeddings = await openai.embed(
  {
    model: 'text-embedding-3-small',
    input: ['Text 1', 'Text 2'],
  },
  apiKey
);

console.log('Dimensions:', embeddings.output[0].length);
```

### Pattern 4: Error Handling

```typescript
import { AIUError, badApiKeyError, rateLimitError } from '@aiu/core';

try {
  const response = await openai.chat(request, apiKey);
} catch (error) {
  if (error instanceof AIUError) {
    switch (error.code) {
      case 'BAD_API_KEY':
        console.error('Invalid API key');
        break;
      case 'RATE_LIMIT':
        console.error('Rate limited, retry after:', error.details?.retryAfter);
        break;
      case 'TIMEOUT':
        console.error('Request timed out');
        break;
      default:
        console.error('Unknown error:', error.message);
    }
  }
}
```

### Pattern 5: Multi-Provider Fallback

```typescript
async function chatWithFallback(message: string) {
  const providers = [
    { adapter: openai, key: keyring.get('openai', 'default') },
    { adapter: anthropic, key: keyring.get('anthropic', 'default') },
  ];

  for (const { adapter, key } of providers) {
    try {
      return await adapter.chat({ model: '...', input: [{ role: 'user', content: message }] }, key);
    } catch (error) {
      console.error(`${adapter.info().name} failed, trying next...`);
      continue;
    }
  }

  throw new Error('All providers failed');
}
```

## Next Steps

1. **Read the docs**:

   - [README.md](./README.md) - Full guide
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - Design details
   - [API.md](./API.md) - API reference

2. **Explore examples**:

   - `examples/basic-chat` - Complete working example

3. **Add more providers**:

   - Read [CONTRIBUTING.md](./CONTRIBUTING.md)
   - Implement `ProviderAdapter` interface

4. **Deploy to production**:
   - Set up PostgreSQL database
   - Store master key in KMS/vault
   - Enable metrics export
   - Configure rate limits

## Troubleshooting

### Build errors

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Database connection issues

```bash
# Check DATABASE_URL
cat packages/storage/.env

# Test connection
cd packages/storage
pnpm db:push
```

### Missing dependencies

```bash
# Install all workspace dependencies
pnpm install -r
```

### API key errors

- Ensure keys are valid and not expired
- Check API key permissions/scopes
- Verify key format (OpenAI: `sk-...`, Anthropic: `sk-ant-...`)

## Support

- Documentation: See docs in this repo
- Issues: Open a GitHub issue
- Examples: Check `examples/` directory

---

**Ready to build!** 🚀
