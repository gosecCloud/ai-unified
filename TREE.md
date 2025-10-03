# Project Structure

Complete file tree of AI Unified monorepo.

```
ai-unified/
│
├── 📄 Configuration Files
│   ├── package.json              # Root workspace config
│   ├── pnpm-workspace.yaml       # pnpm workspace definition
│   ├── tsconfig.json             # Root TypeScript config
│   ├── .eslintrc.json            # ESLint rules
│   ├── .gitignore                # Git ignore patterns
│   ├── .npmrc                    # npm/pnpm config
│   └── .env.example              # Environment template
│
├── 📚 Documentation
│   ├── README.md                 # Main project documentation (500+ lines)
│   ├── QUICKSTART.md             # 5-minute getting started guide
│   ├── ARCHITECTURE.md           # Design decisions & data flows (500+ lines)
│   ├── API.md                    # Complete API reference (500+ lines)
│   ├── CONTRIBUTING.md           # Contribution guidelines
│   ├── PROJECT_SUMMARY.md        # What was built & next steps
│   ├── TREE.md                   # This file
│   └── LICENSE                   # MIT License
│
├── 📦 packages/                  # All publishable packages
│   │
│   ├── core/                     # @aiu/core - Foundation layer
│   │   ├── src/
│   │   │   ├── types.ts          # 600+ lines: ProviderAdapter, ModelInfo, ChatRequest, etc.
│   │   │   ├── errors.ts         # 200+ lines: AIUError, factory functions
│   │   │   ├── events.ts         # 100+ lines: Event emitter system
│   │   │   ├── utils.ts          # 150+ lines: Parsing, redaction, estimation
│   │   │   └── index.ts          # Public exports
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── transport/                # @aiu/transport - HTTP & streaming
│   │   ├── src/
│   │   │   ├── http-client.ts    # 250+ lines: Fetch-based HTTP with retries
│   │   │   ├── sse-parser.ts     # 100+ lines: Server-Sent Events parser
│   │   │   ├── rate-limiter.ts   # 150+ lines: Token bucket rate limiter
│   │   │   └── index.ts          # Public exports
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── keyring/                  # @aiu/keyring - Encrypted key management
│   │   ├── src/
│   │   │   ├── crypto.ts         # 150+ lines: XChaCha20-Poly1305 encryption
│   │   │   ├── keyring.ts        # 200+ lines: High-level keyring API
│   │   │   └── index.ts          # Public exports
│   │   ├── package.json          # Depends on: sodium-native
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── storage/                  # @aiu/storage - Database layer
│   │   ├── prisma/
│   │   │   └── schema.prisma     # 100+ lines: Multi-DB schema (Postgres/MySQL/SQLite/MSSQL)
│   │   ├── src/
│   │   │   ├── client.ts         # Prisma client singleton
│   │   │   ├── repositories.ts   # 400+ lines: 4 repository implementations
│   │   │   └── index.ts          # Public exports
│   │   ├── package.json          # Depends on: @prisma/client, prisma
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── model-registry/           # @aiu/model-registry - Model discovery & caching
│   │   ├── src/
│   │   │   ├── cache.ts          # 100+ lines: LRU memory cache
│   │   │   ├── registry.ts       # 200+ lines: Registry with multi-tier cache
│   │   │   └── index.ts          # Public exports
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── observability/            # @aiu/observability - Logging & metrics
│   │   ├── src/
│   │   │   ├── logger.ts         # 100+ lines: Pino logger with redaction
│   │   │   ├── metrics.ts        # 150+ lines: In-memory metrics collector
│   │   │   └── index.ts          # Public exports
│   │   ├── package.json          # Depends on: pino, pino-pretty
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── provider-openai/          # @aiu/provider-openai - OpenAI adapter
│   │   ├── src/
│   │   │   ├── adapter.ts        # 400+ lines: Chat, embeddings, streaming
│   │   │   └── index.ts          # Public exports
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   └── provider-anthropic/       # @aiu/provider-anthropic - Anthropic adapter
│       ├── src/
│       │   ├── adapter.ts        # 300+ lines: Chat with streaming
│       │   └── index.ts          # Public exports
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts
│
└── 💡 examples/                  # Example applications
    │
    └── basic-chat/               # Complete working example
        ├── src/
        │   └── index.ts          # 200+ lines: Full integration demo
        ├── package.json
        ├── tsconfig.json
        ├── .env.example          # API key template
        └── README.md             # Example documentation
```

## Package Dependencies

```
@aiu/core
  └── (no dependencies)

@aiu/transport
  └── @aiu/core

@aiu/keyring
  ├── @aiu/core
  └── sodium-native (native module)

@aiu/storage
  ├── @aiu/core
  └── @prisma/client + prisma

@aiu/model-registry
  ├── @aiu/core
  └── @aiu/storage

@aiu/observability
  ├── @aiu/core
  ├── pino
  └── pino-pretty

@aiu/provider-openai
  ├── @aiu/core
  └── @aiu/transport

@aiu/provider-anthropic
  ├── @aiu/core
  └── @aiu/transport

examples/basic-chat
  ├── @aiu/core
  ├── @aiu/keyring
  ├── @aiu/model-registry
  ├── @aiu/observability
  ├── @aiu/provider-openai
  ├── @aiu/provider-anthropic
  ├── @aiu/storage
  └── @aiu/transport
```

## File Count

| Category             | Count |
| -------------------- | ----- |
| TypeScript files     | 31    |
| Config files         | 29    |
| Documentation files  | 8     |
| Prisma schema        | 1     |
| **Total**            | **69**|

## Lines of Code

| Package                   | LoC   |
| ------------------------- | ----- |
| @aiu/core                 | ~1050 |
| @aiu/transport            | ~500  |
| @aiu/keyring              | ~350  |
| @aiu/storage              | ~500  |
| @aiu/model-registry       | ~300  |
| @aiu/observability        | ~250  |
| @aiu/provider-openai      | ~400  |
| @aiu/provider-anthropic   | ~300  |
| examples/basic-chat       | ~200  |
| **Total Code**            | ~3850 |
| **Documentation**         | ~1700 |
| **Grand Total**           | ~5550 |

## Build Artifacts

After running `pnpm build`, each package generates:

```
packages/*/dist/
  ├── index.js          # ESM bundle
  ├── index.cjs         # CommonJS bundle
  ├── index.d.ts        # TypeScript declarations
  ├── index.d.ts.map    # Declaration source maps
  ├── index.js.map      # ESM source maps
  └── index.cjs.map     # CJS source maps
```

## Key Features by Package

### @aiu/core (Foundation)

- ✅ `ProviderAdapter` interface
- ✅ 15+ TypeScript types
- ✅ 11 error codes
- ✅ Event system
- ✅ Utilities (parsing, redaction, token estimation)

### @aiu/transport (Networking)

- ✅ Fetch-based HTTP client
- ✅ Exponential backoff + jitter
- ✅ SSE parser
- ✅ Token bucket rate limiter
- ✅ Edge-compatible

### @aiu/keyring (Security)

- ✅ XChaCha20-Poly1305 encryption
- ✅ Argon2id key derivation
- ✅ At-rest encryption
- ✅ Key rotation
- ✅ Secure memory handling

### @aiu/storage (Database)

- ✅ Prisma ORM
- ✅ Multi-DB support (5+ databases)
- ✅ Repository pattern
- ✅ Type-safe queries
- ✅ Migrations

### @aiu/model-registry (Discovery)

- ✅ Live model fetching
- ✅ Multi-tier caching (memory + DB)
- ✅ Query API
- ✅ TTL-based invalidation
- ✅ Fallback to last-known models

### @aiu/observability (Monitoring)

- ✅ Pino structured logger
- ✅ Auto-redaction
- ✅ In-memory metrics
- ✅ Counters/Gauges/Histograms
- ✅ Percentile calculations

### @aiu/provider-openai (OpenAI)

- ✅ Chat completions
- ✅ Streaming
- ✅ Embeddings
- ✅ Model discovery
- ✅ Full type mapping

### @aiu/provider-anthropic (Anthropic)

- ✅ Chat completions
- ✅ Streaming
- ✅ System messages
- ✅ Static model catalog
- ✅ Full type mapping

## Quick Navigation

| Need                    | Go to                                      |
| ----------------------- | ------------------------------------------ |
| Get started             | [QUICKSTART.md](./QUICKSTART.md)          |
| Understand architecture | [ARCHITECTURE.md](./ARCHITECTURE.md)       |
| API reference           | [API.md](./API.md)                         |
| Contribute              | [CONTRIBUTING.md](./CONTRIBUTING.md)       |
| Example code            | [examples/basic-chat](./examples/basic-chat) |
| Project summary         | [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) |
| Main README             | [README.md](./README.md)                   |

---

**Total**: 69 files, ~5550 lines of production-quality TypeScript + documentation.
