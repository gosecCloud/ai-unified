# API Reference

Complete API documentation for AI Unified packages.

## Table of Contents

- [@aiu/core](#aiucore)
- [@aiu/keyring](#aiukeyring)
- [@aiu/model-registry](#aiumodel-registry)
- [@aiu/transport](#aiutransport)
- [@aiu/storage](#aiustorage)
- [@aiu/observability](#aiuobservability)
- [@aiu/provider-openai](#aiuprovider-openai)
- [@aiu/provider-anthropic](#aiuprovider-anthropic)

---

## @aiu/core

Core types, errors, and utilities.

### Types

#### `ProviderAdapter`

Main interface that all provider adapters must implement.

```typescript
interface ProviderAdapter {
  info(): ProviderInfo;
  validateApiKey(key: string): Promise<{ valid: boolean; reason?: string; scopes?: string[] }>;
  listModels(key: string): Promise<ModelInfo[]>;
  chat(req: ChatRequest, key: string): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>>;
  embed?(req: EmbedRequest, key: string): Promise<EmbedResponse>;
  image?(req: AIRequest, key: string): Promise<AIResponse<string[]>>;
  audio?(req: AIRequest, key: string): Promise<AIResponse>;
}
```

#### `ModelInfo`

Describes an AI model's capabilities.

```typescript
interface ModelInfo {
  providerId: string;
  modelId: string;
  kind: ModelKind; // 'chat' | 'embed' | 'image' | 'audio' | 'rerank' | 'tool'
  contextWindow?: number;
  maxOutputTokens?: number;
  modalities?: Modality[]; // 'text' | 'image' | 'audio' | 'video'
  deprecated?: boolean;
  costPerInputToken?: number;
  costPerOutputToken?: number;
  metadata?: Record<string, unknown>;
}
```

#### `ChatRequest`

Unified chat completion request.

```typescript
interface ChatRequest {
  model: string; // "provider:model" or alias
  input: Message[];
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: Tool[];
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    stop?: string | string[];
    seed?: number;
    timeoutMs?: number;
  };
  metadata?: Record<string, string>;
}
```

#### `ChatResponse`

Unified chat completion response.

```typescript
interface ChatResponse {
  model: string;
  id: string;
  created: number;
  output: Message;
  usage?: Usage;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  raw?: unknown;
}
```

### Errors

#### `AIUError`

Base error class with structured error codes.

```typescript
class AIUError extends Error {
  code: AIUErrorCode;
  providerId?: string;
  details?: unknown;
  cause?: Error;
}
```

#### Error Factory Functions

```typescript
function badApiKeyError(providerId: string, reason?: string): AIUError;
function rateLimitError(providerId: string, retryAfter?: number): AIUError;
function timeoutError(providerId: string, timeoutMs: number): AIUError;
function providerDownError(providerId: string, statusCode?: number): AIUError;
function modelNotFoundError(providerId: string, modelId: string): AIUError;
function unsupportedFeatureError(providerId: string, feature: string): AIUError;
function validationError(message: string, details?: unknown): AIUError;
function networkError(providerId: string, cause: Error): AIUError;
function parsingError(providerId: string, message: string, cause?: Error): AIUError;
function storageError(message: string, cause?: Error): AIUError;
function encryptionError(message: string, cause?: Error): AIUError;
```

### Utilities

```typescript
// Parse "provider:model" string
function parseModelString(modelString: string): { providerId?: string; modelId: string };

// Generate unique request ID
function generateRequestId(): string;

// Calculate exponential backoff with jitter
function calculateBackoff(attempt: number, baseMs?: number, maxMs?: number): number;

// Redact API keys from text
function redactSecrets(text: string): string;

// Estimate token count (rough)
function estimateTokens(text: string): number;

// Calculate cost
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  costPerInputToken: number,
  costPerOutputToken: number
): number;
```

---

## @aiu/keyring

Secure API key management with encryption.

### `Keyring`

Main keyring class for managing encrypted keys.

```typescript
class Keyring {
  constructor(options: KeyringOptions);

  // Generate a new master key (32 bytes)
  static generateMasterKey(): Buffer;

  // Save an API key (encrypted)
  save(options: SaveKeyOptions): StoredKey;

  // Get and decrypt an API key
  get(providerId: string, alias: string): string;

  // Get key metadata without decrypting
  getInfo(providerId: string, alias: string): ApiKeyInfo | undefined;

  // List all keys (metadata only)
  list(providerId?: string): ApiKeyInfo[];

  // Update key status
  updateStatus(providerId: string, alias: string, status: KeyStatus): void;

  // Mark key as validated
  markValidated(providerId: string, alias: string, scopes?: string[]): void;

  // Delete a key
  delete(providerId: string, alias: string): boolean;

  // Rotate a key
  rotate(options: SaveKeyOptions & { oldAlias?: string }): StoredKey;

  // Export/import for persistence
  export(): StoredKey[];
  import(keys: StoredKey[]): void;

  // Clear all keys from memory
  clear(): void;
}
```

### Cryptographic Functions

```typescript
// Generate encryption key
function generateKey(): Buffer;

// Encrypt plaintext
function encrypt(plaintext: string, key: Buffer, associatedData?: string): string;

// Decrypt ciphertext
function decrypt(ciphertext: string, key: Buffer, associatedData?: string): string;

// Derive key from password (Argon2id)
function deriveKeyFromPassword(password: string, salt?: Buffer): { key: Buffer; salt: Buffer };

// Secure comparison
function secureCompare(a: string, b: string): boolean;

// Zero out buffer
function secureZero(buffer: Buffer): void;
```

---

## @aiu/model-registry

Model discovery and caching.

### `ModelRegistry`

```typescript
class ModelRegistry {
  constructor(options?: ModelRegistryOptions);

  // Register a provider adapter
  registerProvider(adapter: ProviderAdapter): void;

  // Unregister a provider
  unregisterProvider(providerId: string): void;

  // Refresh models for a provider
  refresh(providerId: string, apiKey: string): Promise<ModelInfo[]>;

  // Refresh all providers
  refreshAll(keyResolver: (providerId: string) => Promise<string | undefined>): Promise<void>;

  // Get all models
  all(): Promise<ModelInfo[]>;

  // Find models by query
  find(query?: ModelQuery): Promise<ModelInfo[]>;

  // Find specific model
  findOne(providerId: string, modelId: string): Promise<ModelInfo | undefined>;

  // Invalidate cache
  invalidateCache(providerId: string): void;

  // Clear all caches
  clearCaches(): void;

  // Get registered providers
  getProviders(): string[];
}
```

### `ModelQuery`

```typescript
interface ModelQuery {
  providerId?: string;
  kind?: string;
  minContext?: number;
  excludeDeprecated?: boolean;
}
```

---

## @aiu/transport

HTTP transport with retries and streaming.

### `HttpClient`

```typescript
class HttpClient {
  constructor(options?: HttpClientOptions);

  // Make HTTP request with retries
  request<T>(url: string, options?: RequestOptions, providerId?: string): Promise<T>;

  // Get raw response
  requestRaw(url: string, options?: RequestOptions, providerId?: string): Promise<Response>;

  // Stream response
  stream(url: string, options?: RequestOptions, providerId?: string): AsyncIterable<Uint8Array>;
}
```

### SSE Parsing

```typescript
// Parse Server-Sent Events
async function* parseSSE(stream: AsyncIterable<Uint8Array>): AsyncIterable<SSEEvent>;

// Parse JSON SSE data
async function* parseSSEJSON<T>(stream: AsyncIterable<Uint8Array>): AsyncIterable<T>;
```

### Rate Limiting

```typescript
class RateLimiter {
  constructor(options: RateLimiterOptions);

  // Try to consume tokens (non-blocking)
  tryConsume(tokens?: number): boolean;

  // Consume tokens (blocks until available)
  consume(tokens?: number): Promise<void>;

  // Get available tokens
  getAvailableTokens(): number;

  // Reset limiter
  reset(): void;
}

class KeyedRateLimiter<K = string> {
  constructor(options: RateLimiterOptions);

  consume(key: K, tokens?: number): Promise<void>;
  tryConsume(key: K, tokens?: number): boolean;
  getAvailableTokens(key: K): number;
  reset(key: K): void;
  resetAll(): void;
}
```

---

## @aiu/storage

Database storage with Prisma.

### Repositories

#### `PrismaProviderRepository`

```typescript
class PrismaProviderRepository {
  create(id: string, name: string): Promise<void>;
  findById(id: string): Promise<{ id: string; name: string } | null>;
  list(): Promise<{ id: string; name: string }[]>;
  delete(id: string): Promise<void>;
}
```

#### `PrismaApiKeyRepository`

```typescript
class PrismaApiKeyRepository {
  save(key: Omit<ApiKeyInfo, 'id'> & { id?: string }): Promise<ApiKeyInfo>;
  findById(id: string): Promise<ApiKeyInfo | null>;
  findByAlias(providerId: string, alias: string): Promise<ApiKeyInfo | null>;
  list(providerId?: string): Promise<ApiKeyInfo[]>;
  updateStatus(id: string, status: KeyStatus): Promise<void>;
  markValidated(id: string, scopes?: string[]): Promise<void>;
  delete(id: string): Promise<void>;
}
```

#### `PrismaModelRepository`

```typescript
class PrismaModelRepository {
  saveMany(models: ModelInfo[]): Promise<void>;
  findByProviderAndModel(providerId: string, modelId: string): Promise<ModelInfo | null>;
  list(providerId?: string, kind?: string): Promise<ModelInfo[]>;
  deleteByProvider(providerId: string): Promise<void>;
}
```

#### `PrismaRequestRepository`

```typescript
class PrismaRequestRepository {
  save(log: Omit<RequestLog, 'id'>): Promise<RequestLog>;
  findById(id: string): Promise<RequestLog | null>;
  list(options?: {
    providerId?: string;
    modelId?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<RequestLog[]>;
  getStats(options?: {
    providerId?: string;
    from?: Date;
    to?: Date;
  }): Promise<{
    count: number;
    avgLatencyMs: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
  }>;
}
```

---

## @aiu/observability

Logging and metrics.

### Logging

```typescript
// Create logger
function createLogger(options?: LoggerOptions): pino.Logger;

// Create child logger with context
function withContext(logger: pino.Logger, context: Record<string, unknown>): pino.Logger;

// Default logger
const defaultLogger: pino.Logger;
```

### Metrics

```typescript
class MetricsCollector {
  // Increment counter
  increment(name: string, value?: number, labels?: Record<string, string>): void;

  // Set gauge
  gauge(name: string, value: number, labels?: Record<string, string>): void;

  // Record histogram
  histogram(name: string, value: number, labels?: Record<string, string>): void;

  // Get values
  getCounter(name: string, labels?: Record<string, string>): number;
  getGauge(name: string, labels?: Record<string, string>): number | undefined;
  getHistogramStats(
    name: string,
    labels?: Record<string, string>
  ): {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  } | undefined;

  // Get all metrics
  getMetrics(limit?: number): AnyMetric[];

  // Reset
  reset(): void;
}

// Default metrics instance
const defaultMetrics: MetricsCollector;
```

---

## @aiu/provider-openai

OpenAI provider adapter.

### `OpenAIAdapter`

Implements `ProviderAdapter` for OpenAI.

**Supported**:

- Chat completions (streaming & non-streaming)
- Embeddings
- Images (future)
- Audio (future)

**Example**:

```typescript
import { OpenAIAdapter } from '@aiu/provider-openai';

const adapter = new OpenAIAdapter();

// Chat
const response = await adapter.chat(
  {
    model: 'gpt-4o-mini',
    input: [{ role: 'user', content: 'Hello!' }],
    options: { temperature: 0.8 },
  },
  apiKey
);

// Streaming
const stream = await adapter.chat(
  {
    model: 'gpt-4o',
    input: messages,
    options: { stream: true },
  },
  apiKey
);

for await (const chunk of stream) {
  console.log(chunk.delta.content);
}

// Embeddings
const embeddings = await adapter.embed(
  {
    model: 'text-embedding-3-small',
    input: ['text1', 'text2'],
  },
  apiKey
);
```

---

## @aiu/provider-anthropic

Anthropic/Claude provider adapter.

### `AnthropicAdapter`

Implements `ProviderAdapter` for Anthropic.

**Supported**:

- Chat completions (streaming & non-streaming)
- Vision (via message content)

**Example**:

```typescript
import { AnthropicAdapter } from '@aiu/provider-anthropic';

const adapter = new AnthropicAdapter();

// Chat
const response = await adapter.chat(
  {
    model: 'claude-3-5-sonnet-20241022',
    input: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'What is 2+2?' },
    ],
    options: { max_tokens: 1024 },
  },
  apiKey
);

// Streaming
const stream = await adapter.chat(
  {
    model: 'claude-3-5-haiku-20241022',
    input: messages,
    options: { stream: true },
  },
  apiKey
);

for await (const chunk of stream) {
  console.log(chunk.delta.content);
}
```

---

## Common Patterns

### Complete Setup

```typescript
import { Keyring } from '@aiu/keyring';
import { ModelRegistry } from '@aiu/model-registry';
import { OpenAIAdapter } from '@aiu/provider-openai';
import { AnthropicAdapter } from '@aiu/provider-anthropic';
import { getPrismaClient, PrismaModelRepository } from '@aiu/storage';
import { createLogger, defaultMetrics } from '@aiu/observability';

// 1. Initialize
const masterKey = Keyring.generateMasterKey();
const keyring = new Keyring({ masterKey });
const logger = createLogger({ level: 'info', pretty: true });

// 2. Register providers
const prisma = getPrismaClient();
const modelRepo = new PrismaModelRepository(prisma);
const registry = new ModelRegistry({ repository: modelRepo });

const openai = new OpenAIAdapter();
const anthropic = new AnthropicAdapter();

registry.registerProvider(openai);
registry.registerProvider(anthropic);

// 3. Store keys
keyring.save({ providerId: 'openai', alias: 'prod', key: 'sk-...' });
keyring.save({ providerId: 'anthropic', alias: 'prod', key: 'sk-ant-...' });

// 4. Refresh models
await registry.refresh('openai', keyring.get('openai', 'prod'));
await registry.refresh('anthropic', keyring.get('anthropic', 'prod'));

// 5. Make requests
const models = await registry.find({ kind: 'chat', minContext: 100000 });
logger.info({ count: models.length }, 'Available models');

const response = await openai.chat(request, keyring.get('openai', 'prod'));
defaultMetrics.histogram('request.latency', Date.now() - start);
```

---

For more examples, see `examples/` directory.
