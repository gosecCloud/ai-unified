# Basic Chat Example

Demonstrates core AI Unified features:

- Encrypted API key management
- Provider registration
- Model discovery
- Non-streaming chat (OpenAI)
- Streaming chat (Anthropic)
- Embeddings generation
- Metrics collection

## Setup

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Add your API keys to `.env`:

   ```
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Build all packages from root:

   ```bash
   cd ../..
   pnpm install
   pnpm build
   ```

4. Run the example:
   ```bash
   cd examples/basic-chat
   pnpm dev
   ```

## What it does

1. **Keyring**: Generates master encryption key and stores API keys encrypted
2. **Providers**: Registers OpenAI and Anthropic adapters
3. **Validation**: Validates API keys with provider APIs
4. **Models**: Discovers available models from each provider
5. **Chat**: Demonstrates both streaming and non-streaming chat
6. **Embeddings**: Generates text embeddings (OpenAI)
7. **Metrics**: Tracks latency and success rates

## Expected Output

```
🤖 AI Unified - Basic Chat Example
🔐 Initializing keyring...
✅ OpenAI key stored
✅ Anthropic key stored
📦 Registering providers...
OpenAI key validation: valid=true
OpenAI models discovered: count=50+
Anthropic key validation: valid=true
Anthropic models available: count=5

💬 Testing OpenAI chat (non-streaming)...
📝 Response: Quantum entanglement is when two particles become interconnected...

🌊 Testing Anthropic chat (streaming)...
🎭 Streaming response:
Types compile clean,
Variables strictly defined—
Code runs without fear.

🔢 Testing OpenAI embeddings...
Embeddings generated: embeddings=2, dimensions=1536

📊 Metrics Summary:
  Total requests: 3
  Avg latency: 1234ms
  P95 latency: 2100ms
  Min latency: 543ms
  Max latency: 2156ms

✨ Example completed
```
