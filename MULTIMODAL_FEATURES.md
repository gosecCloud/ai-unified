# AI Unified - Multi-Modal Features

## 🎉 Overview

AI Unified now supports **full multi-modal capabilities** beyond chat and embeddings:

1. **Image Generation** - Create images from text prompts
2. **Audio Transcription** - Convert speech to text (speech-to-text)
3. **Text-to-Speech** - Convert text to audio (TTS)
4. **Document Reranking** - Reorder documents by relevance

This document covers all new features, provider support, and usage examples.

---

## 📊 Provider Support Matrix

| Provider | Image Generation | Audio Transcription | Text-to-Speech | Reranking |
|----------|-----------------|-------------------|----------------|-----------|
| OpenAI | ✅ DALL-E 3 | ✅ Whisper | ✅ TTS-1 | ❌ |
| Anthropic | ❌ | ❌ | ❌ | ❌ |
| Google (Gemini) | ❌ | ❌ | ❌ | ❌ |
| Cohere | ❌ | ❌ | ❌ | ✅ Rerank v3 |
| Stability AI | ✅ SDXL | ❌ | ❌ | ❌ |
| ElevenLabs | ❌ | ❌ | ✅ Voice AI | ❌ |
| AssemblyAI | ❌ | ✅ Best/Nano | ❌ | ❌ |
| Jina AI | ❌ | ❌ | ❌ | ✅ Reranker v2 |

---

## 🎨 Image Generation

### Supported Providers

#### OpenAI (DALL-E)
- Models: `dall-e-3`, `dall-e-2`
- Sizes: 256x256, 512x512, 1024x1024, 1792x1024, 1024x1792
- Quality: standard, hd
- Styles: vivid, natural

#### Stability AI
- Models: `stable-diffusion-v3`, `stable-diffusion-xl-1024-v1-0`
- Sizes: Custom (up to 2048x2048)
- Advanced: CFG scale, steps, seed control

### SDK Usage

```typescript
import { AIU } from '@aiu/sdk';
import { StabilityAdapter } from '@aiu/provider-stability';

const aiu = new AIU({ keyring, registry, requestRepository });

// Register Stability AI provider
registry.registerProvider(new StabilityAdapter());

// Generate images
const response = await aiu.image({
  model: 'openai:dall-e-3',
  input: 'A futuristic city with flying cars at sunset',
  options: {
    n: 2,
    size: '1024x1024',
    quality: 'hd',
    style: 'vivid',
  },
});

// Save images
for (const image of response.images) {
  if (image.url) {
    console.log('Image URL:', image.url);
  } else if (image.b64_json) {
    const buffer = Buffer.from(image.b64_json, 'base64');
    fs.writeFileSync('generated-image.png', buffer);
  }
}
```

### CLI Usage

```bash
# Generate with OpenAI DALL-E 3
aiu image "A majestic mountain landscape" \
  --model openai:dall-e-3 \
  --size 1024x1024 \
  --quality hd \
  --style vivid \
  --number 2 \
  --output ./images

# Generate with Stability AI
aiu image "Cyberpunk cityscape at night" \
  --model stability:stable-diffusion-xl-1024-v1-0 \
  --size 1024x1024 \
  --output ./images
```

---

## 🎤 Audio Transcription (Speech-to-Text)

### Supported Providers

#### OpenAI (Whisper)
- Model: `whisper-1`
- Languages: 99+ languages
- Formats: json, text, srt, vtt, verbose_json
- Features: Automatic language detection

#### AssemblyAI
- Models: `best` (most accurate), `nano` (faster/cheaper)
- Languages: English, Spanish, French, German, etc.
- Features: Speaker diarization, sentiment analysis, word-level timestamps

### SDK Usage

```typescript
import { AssemblyAIAdapter } from '@aiu/provider-assemblyai';

registry.registerProvider(new AssemblyAIAdapter());

// Transcribe from URL
const response = await aiu.transcribe({
  model: 'openai:whisper-1',
  input: { url: 'https://example.com/audio.mp3' },
  options: {
    language: 'en',
    response_format: 'verbose_json',
  },
});

// Transcribe from file buffer
const audioBuffer = fs.readFileSync('./recording.mp3');
const response = await aiu.transcribe({
  model: 'assemblyai:best',
  input: audioBuffer,
});

console.log('Transcription:', response.text);
console.log('Language:', response.language);
console.log('Duration:', response.duration);

// Access segments with timestamps
for (const segment of response.segments || []) {
  console.log(`[${segment.start}s - ${segment.end}s] ${segment.text}`);
}
```

### CLI Usage

```bash
# Transcribe with OpenAI Whisper
aiu transcribe audio.mp3 \
  --model openai:whisper-1 \
  --language en \
  --format text \
  --output transcript.txt

# Transcribe from URL with AssemblyAI
aiu transcribe "https://example.com/podcast.mp3" \
  --model assemblyai:best \
  --format json \
  --output transcript.json

# Auto-detect language
aiu transcribe multilingual.mp3 --model openai:whisper-1
```

---

## 🔊 Text-to-Speech

### Supported Providers

#### OpenAI
- Models: `tts-1` (standard), `tts-1-hd` (high quality)
- Voices: alloy, echo, fable, onyx, nova, shimmer
- Formats: mp3, opus, aac, flac, wav
- Speed: 0.25x to 4.0x

#### ElevenLabs
- Models: `eleven_monolingual_v1`, `eleven_multilingual_v2`, `eleven_turbo_v2`
- Voices: Custom voice library (50+ pre-built voices)
- Languages: 29+ languages
- Features: Voice cloning, emotion control

### SDK Usage

```typescript
import { ElevenLabsAdapter } from '@aiu/provider-elevenlabs';

registry.registerProvider(new ElevenLabsAdapter({
  defaultVoice: 'EXAVITQu4vr4xnSDxMaL', // Bella
}));

// Generate speech with OpenAI
const response = await aiu.speak({
  model: 'openai:tts-1-hd',
  input: 'Welcome to AI Unified! This is a text-to-speech demo.',
  options: {
    voice: 'nova',
    speed: 1.0,
    response_format: 'mp3',
  },
});

// Save audio
fs.writeFileSync('speech.mp3', response.audio);
console.log('Format:', response.format);

// Generate with ElevenLabs
const response = await aiu.speak({
  model: 'elevenlabs:eleven_turbo_v2',
  input: 'Hello from ElevenLabs!',
  options: {
    voice: 'EXAVITQu4vr4xnSDxMaL',
  },
});
```

### CLI Usage

```bash
# Generate speech with OpenAI
aiu speak "Hello, this is a test of text-to-speech" \
  --model openai:tts-1-hd \
  --voice nova \
  --speed 1.0 \
  --format mp3 \
  --output speech.mp3

# Generate with ElevenLabs
aiu speak "Welcome to our podcast!" \
  --model elevenlabs:eleven_multilingual_v2 \
  --voice EXAVITQu4vr4xnSDxMaL \
  --output podcast-intro.mp3

# Slower speech for learning
aiu speak "This is spoken slowly for learning purposes" \
  --model openai:tts-1 \
  --voice alloy \
  --speed 0.75
```

---

## 🔍 Document Reranking

Reranking improves search results by re-ordering documents based on semantic relevance to a query.

### Supported Providers

#### Cohere
- Models: `rerank-english-v3.0`, `rerank-multilingual-v3.0`
- Languages: English only / 100+ languages
- Max documents: 1000
- Context: 4096 tokens per document

#### Jina AI
- Models: `jina-reranker-v2-base-multilingual`, `jina-reranker-v1-base-en`
- Languages: Multilingual / English
- Max documents: 1000
- Context: 8192 tokens per document

### SDK Usage

```typescript
import { JinaAdapter } from '@aiu/provider-jina';

registry.registerProvider(new JinaAdapter());

// Rerank documents
const response = await aiu.rerank({
  model: 'cohere:rerank-english-v3.0',
  query: 'What is quantum computing?',
  documents: [
    'Quantum computing uses quantum mechanics principles',
    'Cloud computing provides on-demand resources',
    'Quantum computers use qubits instead of bits',
    'Traditional computers use binary logic',
  ],
  options: {
    top_n: 2,
    return_documents: true,
  },
});

// Results are sorted by relevance
for (const result of response.results) {
  console.log(`Score: ${result.relevance_score}`);
  console.log(`Document: ${result.document}`);
}
```

### CLI Usage

```bash
# Rerank text documents
aiu rerank "machine learning algorithms" \
  "Neural networks are used in AI" \
  "Python is a programming language" \
  "Deep learning is a subset of ML" \
  --model cohere:rerank-english-v3.0 \
  --top-n 2 \
  --show-documents

# Rerank documents from files
aiu rerank "climate change solutions" \
  doc1.txt doc2.txt doc3.txt doc4.txt \
  --model jina:jina-reranker-v2-base-multilingual \
  --top-n 3

# Multilingual reranking
aiu rerank "¿Qué es la inteligencia artificial?" \
  "AI systems mimic human intelligence" \
  "La IA aprende de los datos" \
  "Machine learning is a type of AI" \
  --model cohere:rerank-multilingual-v3.0
```

---

## 🏗️ Architecture Updates

### Core Types

All new types are defined in `@aiu/core`:

```typescript
// Image generation
interface ImageRequest extends Omit<AIRequest, 'input'> {
  input: string; // Text prompt
  options?: {
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
    response_format?: 'url' | 'b64_json';
  };
}

interface ImageResponse {
  providerId: string;
  modelId: string;
  images: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  usage?: { totalTokens?: number };
}

// Audio transcription
interface TranscribeRequest extends Omit<AIRequest, 'input'> {
  input: string | Buffer | { url: string } | { base64: string };
  options?: {
    language?: string;
    prompt?: string;
    response_format?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
    temperature?: number;
  };
}

interface TranscribeResponse {
  providerId: string;
  modelId: string;
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

// Text-to-speech
interface SpeechRequest extends Omit<AIRequest, 'input'> {
  input: string;
  options?: {
    voice?: string;
    speed?: number;
    response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';
  };
}

interface SpeechResponse {
  providerId: string;
  modelId: string;
  audio: Buffer | string;
  format: string;
}

// Reranking
interface RerankRequest extends Omit<AIRequest, 'input'> {
  query: string;
  documents: Array<string | RerankDocument>;
  options?: {
    top_n?: number;
    return_documents?: boolean;
  };
}

interface RerankResponse {
  providerId: string;
  modelId: string;
  results: RerankResult[];
  usage?: { totalTokens?: number };
}
```

### SDK Orchestrator

The `AIU` class now includes four new methods:

- `aiu.image(req: ImageRequest)` → `ImageResponse`
- `aiu.transcribe(req: TranscribeRequest)` → `TranscribeResponse`
- `aiu.speak(req: SpeechRequest)` → `SpeechResponse`
- `aiu.rerank(req: RerankRequest)` → `RerankResponse`

All methods follow the same patterns as `chat()` and `embed()`:
- Rate limiting
- Concurrency control
- Cost tracking
- Request logging
- Event emission
- Observability metrics

### Provider Adapter Interface

```typescript
interface ProviderAdapter {
  info(): ProviderInfo;
  validateApiKey(key: string): Promise<{ valid: boolean; reason?: string }>;
  listModels(key: string): Promise<ModelInfo[]>;
  chat(req: ChatRequest, key: string): Promise<ChatResponse | AsyncIterable<...>>;

  // Optional capabilities
  embed?(req: EmbedRequest, key: string): Promise<EmbedResponse>;
  image?(req: ImageRequest, key: string): Promise<ImageResponse>;
  audio?(req: TranscribeRequest | SpeechRequest, key: string): Promise<TranscribeResponse | SpeechResponse>;
  rerank?(req: RerankRequest, key: string): Promise<RerankResponse>;
}
```

---

## 📦 New Provider Packages

### @aiu/provider-stability

Stability AI for image generation with Stable Diffusion models.

```typescript
import { StabilityAdapter } from '@aiu/provider-stability';

const adapter = new StabilityAdapter({
  baseUrl: 'https://api.stability.ai/v1',
  apiVersion: '1',
});

registry.registerProvider(adapter);
```

**Models:**
- `stable-diffusion-v3` - Latest version
- `stable-diffusion-xl-1024-v1-0` - SDXL 1.0
- `stable-diffusion-xl-beta-v2-2-2` - Beta (deprecated)

### @aiu/provider-elevenlabs

ElevenLabs for high-quality text-to-speech with voice cloning.

```typescript
import { ElevenLabsAdapter } from '@aiu/provider-elevenlabs';

const adapter = new ElevenLabsAdapter({
  baseUrl: 'https://api.elevenlabs.io/v1',
  defaultVoice: 'EXAVITQu4vr4xnSDxMaL', // Bella
});

registry.registerProvider(adapter);

// Get available voices
const voices = await adapter.getVoices(apiKey);
```

**Models:**
- `eleven_monolingual_v1` - English only
- `eleven_multilingual_v2` - 29 languages
- `eleven_turbo_v2` - Faster, optimized

### @aiu/provider-assemblyai

AssemblyAI for accurate speech-to-text transcription.

```typescript
import { AssemblyAIAdapter } from '@aiu/provider-assemblyai';

const adapter = new AssemblyAIAdapter({
  baseUrl: 'https://api.assemblyai.com/v2',
  pollingInterval: 3000, // Check transcription status every 3s
});

registry.registerProvider(adapter);
```

**Models:**
- `best` - Highest accuracy (~$0.00037/second)
- `nano` - Faster, cheaper (~$0.00015/second)

**Features:**
- Speaker diarization
- Sentiment analysis
- Word-level timestamps
- Auto language detection

### @aiu/provider-jina

Jina AI for embeddings and reranking.

```typescript
import { JinaAdapter } from '@aiu/provider-jina';

const adapter = new JinaAdapter({
  baseUrl: 'https://api.jina.ai/v1',
});

registry.registerProvider(adapter);
```

**Models:**
- `jina-embeddings-v3` - Latest embeddings
- `jina-reranker-v2-base-multilingual` - Multilingual reranking
- `jina-reranker-v1-base-en` - English reranking

---

## 💰 Cost Tracking

All new capabilities support automatic cost tracking:

```typescript
const response = await aiu.image({
  model: 'openai:dall-e-3',
  input: 'A beautiful sunset',
});

// Cost is calculated and logged to database
// Access via request logs:
const logs = await requestRepository.findAll({
  providerId: 'openai',
  modelId: 'dall-e-3',
});

console.log('Total cost:', logs.reduce((sum, log) => sum + (log.cost || 0), 0));
```

---

## 📈 Usage Statistics

### Total Provider Count

AI Unified now supports **13 providers**:

1. OpenAI ✅
2. Anthropic ✅
3. Google (Gemini) ✅
4. Mistral ✅
5. Cohere ✅
6. Ollama (Local) ✅
7. vLLM (Self-Hosted) ✅
8. Azure OpenAI ✅
9. OpenRouter (Gateway) ✅
10. **Stability AI** ✅ (NEW)
11. **ElevenLabs** ✅ (NEW)
12. **AssemblyAI** ✅ (NEW)
13. **Jina AI** ✅ (NEW)

### Capability Coverage

| Capability | Providers | Total |
|------------|-----------|-------|
| Chat | OpenAI, Anthropic, Google, Mistral, Cohere, Ollama, vLLM, Azure, OpenRouter | 9 |
| Embeddings | OpenAI, Google, Cohere, Jina | 4 |
| Image Generation | OpenAI, Stability AI | 2 |
| Audio Transcription | OpenAI, AssemblyAI | 2 |
| Text-to-Speech | OpenAI, ElevenLabs | 2 |
| Reranking | Cohere, Jina AI | 2 |

---

## 🚀 Getting Started

### Install New Providers

```bash
cd /srv/dev/library/ai-unified
pnpm install
pnpm build
```

### Register API Keys

```bash
# Add Stability AI key
aiu provider add stability --alias default

# Add ElevenLabs key
aiu provider add elevenlabs --alias default

# Add AssemblyAI key
aiu provider add assemblyai --alias default

# Add Jina AI key
aiu provider add jina --alias default
```

### Example: Complete Multi-Modal Workflow

```typescript
import { AIU, PersistentKeyring } from '@aiu/sdk';
import { ModelRegistry } from '@aiu/model-registry';
import { StabilityAdapter } from '@aiu/provider-stability';
import { ElevenLabsAdapter } from '@aiu/provider-elevenlabs';
import { AssemblyAIAdapter } from '@aiu/provider-assemblyai';
import { JinaAdapter } from '@aiu/provider-jina';

const registry = new ModelRegistry({ repository: modelRepo });

// Register all providers
registry.registerProvider(new StabilityAdapter());
registry.registerProvider(new ElevenLabsAdapter());
registry.registerProvider(new AssemblyAIAdapter());
registry.registerProvider(new JinaAdapter());

const aiu = new AIU({ keyring, registry, requestRepository });

// 1. Chat with AI
const chatResponse = await aiu.chat({
  model: 'openai:gpt-4o',
  input: [{ role: 'user', content: 'Describe a futuristic city' }],
});

// 2. Generate image from chat response
const imageResponse = await aiu.image({
  model: 'stability:stable-diffusion-xl-1024-v1-0',
  input: chatResponse.output.content,
});

// 3. Create audio narration
const speechResponse = await aiu.speak({
  model: 'elevenlabs:eleven_multilingual_v2',
  input: chatResponse.output.content,
});

// 4. Transcribe audio
const transcriptResponse = await aiu.transcribe({
  model: 'assemblyai:best',
  input: speechResponse.audio,
});

// 5. Rerank documents
const rerankResponse = await aiu.rerank({
  model: 'jina:jina-reranker-v2-base-multilingual',
  query: 'futuristic city',
  documents: [
    chatResponse.output.content,
    transcriptResponse.text,
    'Other document content...',
  ],
});

console.log('Complete multi-modal workflow executed!');
```

---

## 📚 Additional Resources

- [Main README](./README.md) - Project overview
- [Implementation Complete](./IMPLEMENTATION_COMPLETE.md) - Previous features
- [API Documentation](./docs/api.md) - Full API reference
- [Contributing](./CONTRIBUTING.md) - How to contribute

---

## ✅ Summary

AI Unified now provides a **comprehensive multi-modal AI platform** with support for:

✅ Chat & Embeddings (existing)
✅ Image Generation (new)
✅ Audio Transcription (new)
✅ Text-to-Speech (new)
✅ Document Reranking (new)

**Total Implementation:**
- **13 provider adapters**
- **6 AI capabilities**
- **4 new CLI commands**
- **4 new SDK methods**
- **4 new provider packages**
- **Full type safety**
- **Complete observability**
- **Unified API surface**

🎉 AI Unified is now a complete, production-ready multi-modal AI platform!
