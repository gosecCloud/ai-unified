# Known Issues & Limitations

This document tracks known limitations, warnings, and non-critical issues in the AI Unified codebase.

---

## **Dependencies**

### Beta Dependency in Dev Tools (Low Priority)

**Package**: `source-map@0.8.0-beta.0`
**Source**: Transitive dev dependency via `tsup@8.5.0`
**Impact**: None (dev-time only, not in production bundle)
**Status**: Monitored, not blocking

**Details**:
```bash
$ pnpm why source-map
devDependencies:
tsup 8.5.0
└── source-map 0.8.0-beta.0
```

`source-map` is used by the TypeScript build tool (`tsup`) for generating source maps during development builds. This is a pre-release version but:
- ✅ Only used during build time (not in production runtime)
- ✅ Stable in practice (widely used in ecosystem)
- ✅ No known vulnerabilities
- ⚠️ Deprecated warning (beta package)

**Recommendation**: Monitor for `tsup` updates that migrate to stable `source-map`. Not blocking production deployment.

**Last Checked**: 2025-10-02

---

## **Architecture Limitations**

### Node-Only Keyring (Edge Compatibility)

**Component**: `@aiu/keyring`
**Issue**: Uses `sodium-native` (Node.js native module with libsodium bindings)
**Impact**: Cannot run in Edge runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy)

**Current Status**: Transport and SDK are Edge-compatible, but keyring requires Node.js.

**Workarounds**:
1. Use keyring proxy pattern (RPC to Node.js backend for key decryption)
2. Store keys in environment variables (not in encrypted DB)
3. Use Edge-compatible providers that don't require key management

**Future Enhancement**: Add WebCrypto fallback using AES-256-GCM for Edge compatibility.

**Priority**: Medium (planned for Q2 2025)

---

## **Provider-Specific Notes**

### AssemblyAI Key Validation

**Method**: GET /v2/transcript (lists recent transcripts)
**Note**: AssemblyAI does not provide a dedicated key validation endpoint. We use the read-only transcript list endpoint to verify authentication without side effects.

**Previous Implementation**: Used POST with placeholder URL (`https://example.com/test.mp3`) - **Fixed in v0.1.1**

---

## **Type Consistency** (Non-Breaking)

### ChatResponse Shape Variation

**Issue**: Some providers return different ChatResponse structures
**Affected**: Google, Azure, Mistral, Cohere, Ollama, OpenRouter (6 adapters)

**Details**:
- **Core type**: `ChatResponse extends AIResponse<Message>` with `model`, `id`, `created`, `usage`
- **Some providers**: Return `{ providerId, modelId, output, usage }`

**Impact**: TypeScript may show warnings, but runtime works correctly due to structural typing.

**Status**: Planned normalization in Q1 2025 (non-breaking change)

**Workaround**: Use type assertions when necessary:
```typescript
const response = await aiu.chat({...}) as ChatResponse;
```

---

## **Testing Coverage**

### Contract Tests Not Yet Implemented

**Current**: Zero test files
**Impact**: Manual testing only, no CI/CD test validation

**Planned**:
- Contract tests for `ProviderAdapter` interface
- SSE streaming fixtures
- Binary upload/download tests
- E2E tests with env-gated live API keys

**Timeline**: Q1 2025

---

## **Performance Notes**

### Model Registry Cache

**Current**: 30-minute TTL in-memory cache
**Limitation**: No Redis or distributed cache support

**Impact**:
- Cold starts require model list fetch from provider APIs
- Multi-instance deployments each maintain separate caches

**Future**: Redis adapter planned for distributed caching

---

## **Documentation**

### API Reference Completeness

**Status**: Core API documented, some edge cases need examples

**Missing**:
- Multimodal request examples (images, audio)
- Tool/function calling detailed guide
- Advanced error handling patterns
- Custom provider adapter tutorial

**Contributing**: PRs welcome for documentation improvements

---

## **Security Considerations**

### Master Key Management

**Current**: Master key must be provided via environment variable
**No Built-In**: KMS/HSM integration, key rotation automation

**Recommendation**: Use external secret management:
- AWS Secrets Manager
- HashiCorp Vault
- Google Secret Manager
- Azure Key Vault

**Future**: Native KMS adapters planned

---

## **Monitoring This Document**

This document is updated as new issues are discovered or resolved.

**Last Updated**: 2025-10-02
**Next Review**: 2025-11-01

---

## **Reporting Issues**

Found a new issue? Please:
1. Check if it's already listed above
2. Search [GitHub Issues](https://github.com/your-org/ai-unified/issues)
3. Open a new issue with:
   - Clear reproduction steps
   - Expected vs actual behavior
   - Environment details (Node version, OS, etc.)
   - Relevant error messages/logs

**Template**: Use the issue template in `.github/ISSUE_TEMPLATE/`
