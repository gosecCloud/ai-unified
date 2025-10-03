# AI Unified Architecture

This document describes the high-level architecture, design decisions, and data flows.

## Overview

AI Unified is a **TypeScript-first library** that provides:

1. **Unified abstraction** over multiple AI providers
2. **Secure key management** with encryption at rest
3. **Real-time model discovery** with caching
4. **Persistent storage** for config, models, and usage logs
5. **Production-ready** transport with retries, streaming, and rate limiting
6. **Observability** with structured logging and metrics

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  (Your App, CLI, React Components, API Servers)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI Unified SDK                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Keyring    │  │Model Registry│  │ Observability│      │
│  │  (encrypt)   │  │  (cache)     │  │ (logs/metrics)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Provider Adapters                        │   │
│  │  OpenAI | Anthropic | Google | Mistral | Cohere...   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Transport   │  │   Storage    │  │    Events    │      │
│  │(HTTP/Stream) │  │   (Prisma)   │  │  (emitter)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│             External Services & Storage                      │
│  OpenAI API, Anthropic API, PostgreSQL, Redis, etc.         │
└─────────────────────────────────────────────────────────────┘
```

## Core Packages

### 1. `@aiu/core`

**Purpose**: Foundation types, errors, and utilities.

**Exports**:

- `ProviderAdapter` interface
- Type definitions (`ModelInfo`, `ChatRequest`, `AIResponse`, etc.)
- Error classes (`AIUError`, factory functions)
- Event emitter (`AIUEventEmitter`)
- Utility functions (parsing, redaction, token estimation)

**Key Design Decisions**:

- **Provider abstraction**: All providers implement the same `ProviderAdapter` interface
- **Model kinds**: Extensible enum for chat, embeddings, images, audio, etc.
- **Streaming**: Uses `AsyncIterable<StreamChunk<T>>` for universal streaming interface
- **Error codes**: Structured error codes for common failure modes

### 2. `@aiu/transport`

**Purpose**: HTTP communication with production-grade resilience.

**Features**:

- **HTTP client** with configurable timeouts
- **Automatic retries** with exponential backoff + jitter
- **Rate limiting** via token bucket algorithm
- **SSE parsing** for streaming responses
- **Circuit breaker** patterns (future)

**Key Files**:

- `http-client.ts`: Fetch-based HTTP with retry logic
- `sse-parser.ts`: Server-Sent Events parser
- `rate-limiter.ts`: Token bucket rate limiter

**Design**:

- Edge-compatible (fetch API only, no Node-specific code)
- Pluggable retry policies
- Per-provider rate limits via `KeyedRateLimiter`

### 3. `@aiu/keyring`

**Purpose**: Secure API key management.

**Security**:

- **Encryption**: XChaCha20-Poly1305 (via libsodium)
- **Key derivation**: Argon2id for password-based keys
- **At-rest encryption**: All keys stored encrypted
- **In-memory decryption**: Keys never returned in plaintext to DB

**Key Files**:

- `crypto.ts`: Low-level encryption primitives
- `keyring.ts`: High-level keyring API

**Operations**:

- `save()`: Encrypt and store key
- `get()`: Decrypt key (memory-only)
- `rotate()`: Replace key, mark old as revoked
- `export()/import()`: Persist/restore encrypted keys

### 4. `@aiu/storage`

**Purpose**: Database abstraction with Prisma.

**Schema** (`packages/storage/prisma/schema.prisma`):

```
Provider → ApiKey, Model, Request
ApiKey: encrypted keys with status tracking
Model: cached model metadata
Request: usage logs for billing/analytics
```

**Repositories**:

- `ProviderRepository`: CRUD for providers
- `ApiKeyRepository`: Encrypted key storage
- `ModelRepository`: Model catalog persistence
- `RequestRepository`: Usage log + aggregates

**Database Support**:

- PostgreSQL (recommended)
- MySQL
- SQLite (dev/testing)
- SQL Server
- MongoDB (future)

### 5. `@aiu/model-registry`

**Purpose**: Live model discovery with multi-tier caching.

**Architecture**:

```
┌──────────────────────────────────┐
│  Application (find/refresh)      │
└───────────┬──────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│  Memory Cache (LRU, 30min TTL)   │
└───────────┬──────────────────────┘
            │ (cache miss)
            ▼
┌──────────────────────────────────┐
│  Database (Prisma)               │
└───────────┬──────────────────────┘
            │ (DB miss or refresh)
            ▼
┌──────────────────────────────────┐
│  Provider API (live fetch)       │
└──────────────────────────────────┘
```

**Operations**:

- `refresh(providerId, apiKey)`: Force refresh from API
- `all()`: Get all models from cache/DB
- `find(query)`: Filter models by kind, context window, etc.
- `invalidateCache(providerId)`: Clear cache

### 6. `@aiu/observability`

**Purpose**: Structured logging and metrics.

**Components**:

- **Logger**: Pino-based structured logger
  - Auto-redacts secrets (API keys, tokens)
  - Child loggers with context propagation
  - Configurable levels and formatting
- **Metrics**: In-memory collector
  - Counters (requests, errors)
  - Gauges (active connections)
  - Histograms (latency, token usage)
  - Percentiles (p50, p95, p99)

**Future**:

- OpenTelemetry integration
- Prometheus exporter
- Distributed tracing (spans)

### 7. `@aiu/provider-*`

**Purpose**: Provider-specific implementations.

**Current Adapters**:

- `@aiu/provider-openai`: OpenAI (chat, embeddings, images)
- `@aiu/provider-anthropic`: Anthropic/Claude (chat only)

**Future**:

- Google/Vertex AI
- Mistral
- Cohere
- Ollama (local models)
- Azure OpenAI

**Adapter Responsibilities**:

1. Implement `ProviderAdapter` interface
2. Map unified types ↔ provider-specific payloads
3. Handle provider-specific errors
4. Support streaming where available
5. Expose model catalog

**Example** (OpenAI):

```typescript
export class OpenAIAdapter implements ProviderAdapter {
  info() {
    return {
      id: 'openai',
      name: 'OpenAI',
      supports: ['chat', 'embed', 'image'],
      endpoints: { ... },
    };
  }

  async chat(req: ChatRequest, key: string) {
    // Map unified request → OpenAI payload
    // Call OpenAI API via HttpClient
    // Map response → unified ChatResponse
  }
}
```

## Data Flow

### 1. Chat Request (Non-streaming)

```
App → Registry.findOne(providerId, modelId)
        ↓
    Keyring.get(providerId, alias)  [decrypt in memory]
        ↓
    Adapter.chat(request, apiKey)
        ↓
    HttpClient.request(url, payload)
        ↓ [retry on 429/5xx]
    Provider API → Response
        ↓
    Adapter maps → ChatResponse
        ↓
    Logger.info(latency, tokens)
    Metrics.histogram(latency)
    Storage.saveRequestLog()
        ↓
    Return ChatResponse to App
```

### 2. Chat Request (Streaming)

```
App → Adapter.chat(request, { stream: true })
        ↓
    HttpClient.stream(url, payload)
        ↓
    parseSSEJSON(stream)
        ↓
    for await (chunk of stream) {
      yield StreamChunk { delta }
    }
        ↓
    App receives AsyncIterable<StreamChunk>
        ↓
    for await (chunk of iterable) {
      console.log(chunk.delta.content)
    }
```

### 3. Model Discovery

```
App → Registry.refresh(providerId, apiKey)
        ↓
    Adapter.listModels(apiKey)
        ↓
    HttpClient.request(modelsEndpoint)
        ↓
    Provider API → ModelInfo[]
        ↓
    Cache.set(providerId, models)  [memory]
        ↓
    Repository.saveMany(models)    [DB]
        ↓
    Return ModelInfo[]
```

### 4. Key Management

```
App → Keyring.save({ providerId, alias, key })
        ↓
    crypto.encrypt(key, masterKey, providerId)
        ↓ [XChaCha20-Poly1305]
    StoredKey { keyCiphertext }
        ↓
    ApiKeyRepository.save(storedKey)  [Prisma]
        ↓
    Database (encrypted)
```

## Security Model

### Threat Model

**Protected Against**:

- API key exposure in logs (auto-redaction)
- API key theft from DB (encrypted at rest)
- Unauthorized key access (keyring permissions)

**Not Protected Against** (app responsibility):

- Master key compromise (store in HSM/KMS)
- Memory dumps (keys decrypted in-process)
- Compromised app code (runtime access to keys)

### Encryption Details

- **Algorithm**: XChaCha20-Poly1305 (AEAD)
- **Key size**: 32 bytes (256 bits)
- **Nonce**: Random 24 bytes per encryption
- **Associated data**: Provider ID (prevents key reuse across providers)
- **Library**: `sodium-native` (libsodium bindings)

### Key Derivation

```typescript
// From password
deriveKeyFromPassword('password', salt);
// Uses Argon2id with:
//   - OPSLIMIT_INTERACTIVE
//   - MEMLIMIT_INTERACTIVE
//   - Output: 32 bytes
```

## Performance Considerations

### Caching Strategy

1. **Memory cache** (LRU, 30min TTL)

   - Fast lookups
   - Limited capacity (100 providers)

2. **Database cache** (Prisma)

   - Persists across restarts
   - Indexed queries

3. **Live fetch** (Provider API)
   - Fallback when caches miss
   - Background refresh

### Rate Limiting

- **Token bucket** per provider
- Configurable capacity + refill rate
- Blocks until tokens available

### Connection Pooling

- Prisma manages connection pools automatically
- Configurable via `DATABASE_URL` params

## Extensibility

### Adding a New Provider

1. Create `@aiu/provider-yourprovider` package
2. Implement `ProviderAdapter` interface
3. Register with `ModelRegistry`
4. Done!

### Adding a New Model Kind

1. Add to `ModelKind` type in `@aiu/core`
2. Update `ProviderAdapter` interface
3. Implement in relevant providers

### Custom Middleware

```typescript
// Future: Plugin system
registry.use((req, next) => {
  // Pre-processing
  const result = await next(req);
  // Post-processing
  return result;
});
```

## Future Enhancements

### Short Term

- CLI (`aiu` command)
- React UI components
- More provider adapters (Google, Mistral, Cohere)
- Redis cache adapter

### Medium Term

- Cost tracking & budgets
- Policy engine (rate limits, allowed models)
- Webhook support for async operations
- Fine-tuning job management

### Long Term

- Self-hosted model support (vLLM, Ollama)
- Multi-tenant isolation
- Audit logging
- RBAC for key access

## Testing Strategy

### Unit Tests

- Mock HTTP client
- Test error handling
- Validate type mappings

### Integration Tests

- Test against live APIs (sandboxes)
- Database migrations
- End-to-end flows

### Contract Tests

- Ensure all providers conform to `ProviderAdapter`
- Validate SSE parsing
- Test streaming edge cases

## Deployment Patterns

### Serverless (AWS Lambda, Vercel)

```typescript
// Edge-compatible, stateless
import { OpenAIAdapter } from '@aiu/provider-openai';

export async function handler(event) {
  const adapter = new OpenAIAdapter();
  const response = await adapter.chat(req, apiKey);
  return response;
}
```

### Server (Express, Fastify)

```typescript
// With Prisma storage + full observability
import { getPrismaClient } from '@aiu/storage';
import { createLogger } from '@aiu/observability';

const prisma = getPrismaClient();
const logger = createLogger();
// ...
```

### CLI

```bash
aiu provider add openai --key sk-...
aiu models list
aiu run chat --model openai:gpt-4 --input "Hello"
```

## License

MIT
