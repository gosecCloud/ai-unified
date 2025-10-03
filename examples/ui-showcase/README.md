# AI Unified - UI Showcase

A comprehensive Next.js example showcasing all AI Unified UI components and SDK functions.

## 🎯 Overview

This example demonstrates:

- **Chat Interface** - Interactive chat UI with streaming support
- **Agent Monitor** - Real-time autonomous agent monitoring
- **Model Selector** - Multi-provider model browsing and selection
- **Keyring Manager** - Secure API key management

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Run development server:**
   ```bash
   pnpm dev
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
src/
├── app/
│   ├── chat/          # Chat interface demo
│   ├── agent/         # Agent monitor demo
│   ├── models/        # Model selector demo
│   ├── keyring/       # Keyring manager demo
│   ├── api/           # API routes
│   │   ├── chat/      # Chat completion endpoint
│   │   └── agent/     # Agent execution endpoint
│   ├── layout.tsx     # Root layout with navigation
│   ├── page.tsx       # Home page
│   └── globals.css    # Global styles
├── package.json
├── tsconfig.json
└── next.config.js
```

## 🎨 Components Demonstrated

### 1. Chat Interface (`/chat`)

Interactive chat UI with:
- Streaming responses via Server-Sent Events (SSE)
- Markdown rendering support
- Multi-provider model selection
- Message history management
- Real-time typing indicators

**Key Features:**
- ✅ Streaming and non-streaming modes
- ✅ Model selection (GPT-4, Claude, Gemini, etc.)
- ✅ Message persistence
- ✅ Error handling and retry logic

### 2. Agent Monitor (`/agent`)

Real-time monitoring of autonomous coding agents:
- Live event stream visualization
- Task progress tracking
- File operation logs
- Shell command execution display
- Artifact preview

**Supported Agents:**
- Claude Code
- Gemini CLI
- OpenAI Codex

**Event Types:**
- `task_start` - Agent initialization
- `thinking` - Processing phase
- `tool_use` - Tool execution
- `file_edit` - File modifications
- `file_create` - New file creation
- `shell_exec` - Command execution
- `progress` - Task progress updates
- `task_complete` - Completion status
- `error` - Error handling

### 3. Model Selector (`/models`)

Browse and filter AI models:
- Multi-provider support (13 providers)
- Real-time search and filtering
- Model metadata display
- Cost per token calculation
- Context window comparison
- Capability filtering (chat, embed, image, audio)

**Providers:**
- OpenAI, Anthropic, Google, Azure, Cohere
- Ollama, Mistral, Stability AI, ElevenLabs
- AssemblyAI, Jina AI, OpenRouter, vLLM

### 4. Keyring Manager (`/keyring`)

Secure API key management:
- AES-256-GCM encryption
- Real-time key validation
- Provider scope detection
- Key rotation support
- Multi-provider management

**Security Features:**
- 🔒 Encrypted storage
- ✓ Key validation
- 🔄 Rotation support
- 🛡️ Scope management

## 🔌 API Routes

### Chat Completion (`POST /api/chat`)

```typescript
// Request
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "model": "gpt-4",
  "stream": true
}

// Response (streaming)
data: {"delta":{"content":"Hello"}}
data: {"delta":{"content":" there"}}
data: [DONE]
```

### Agent Execution (`POST /api/agent/run`)

```typescript
// Request
{
  "agentId": "claude-code",
  "task": "Create a new feature",
  "workspaceId": "/tmp/workspace",
  "contextFiles": []
}

// Response (streaming)
data: {"type":"task_start","message":"Starting agent"}
data: {"type":"thinking","message":"Analyzing..."}
data: {"type":"file_edit","file":"config.ts"}
data: [DONE]
```

## 🎨 Styling

The example uses:
- **Tailwind CSS** for utility-first styling
- **Custom animations** for smooth transitions
- **Responsive design** for all screen sizes
- **Dark mode support** (optional)

Color scheme:
- Blue: Primary actions and chat
- Purple: Agent monitoring
- Indigo: Model selection
- Green: Security features

## 🔧 Customization

### Adding Real AI Providers

Replace mock API routes with actual SDK calls:

```typescript
// src/app/api/chat/route.ts
import { AIU } from '@aiu/sdk';

const aiu = new AIU({
  keyring: persistentKeyring,
  registry: modelRegistry
});

export async function POST(request: NextRequest) {
  const { messages, model } = await request.json();
  const response = await aiu.chat({ input: messages, model });
  return NextResponse.json(response);
}
```

### Customizing Styles

Edit `globals.css` to change:
- Color scheme
- Typography
- Animations
- Spacing

### Adding New Components

1. Create page in `src/app/[component-name]/page.tsx`
2. Add route to navigation in `layout.tsx`
3. Create corresponding API route if needed

## 📚 Documentation

### Component Props

#### ChatInterface
```typescript
interface ChatInterfaceProps {
  model?: string;
  stream?: boolean;
  onMessage?: (message: Message) => void;
}
```

#### AgentMonitor
```typescript
interface AgentMonitorProps {
  agentId: string;
  workspace: string;
  onEvent?: (event: AgentEvent) => void;
}
```

#### ModelSelector
```typescript
interface ModelSelectorProps {
  providers?: string[];
  kinds?: string[];
  onSelect?: (model: ModelInfo) => void;
}
```

#### KeyringManager
```typescript
interface KeyringManagerProps {
  onKeyAdd?: (key: ApiKey) => void;
  onKeyDelete?: (alias: string) => void;
}
```

## 🧪 Testing

Run the development server and test:

1. **Chat Interface:**
   - Send messages with different models
   - Toggle streaming on/off
   - Test error handling

2. **Agent Monitor:**
   - Run agent with sample task
   - Observe event stream
   - Check artifact display

3. **Model Selector:**
   - Search for models
   - Filter by provider/kind
   - View model details

4. **Keyring Manager:**
   - Add new API keys
   - Validate existing keys
   - Delete keys

## 🚀 Deployment

### Vercel

```bash
vercel deploy
```

### Docker

```bash
docker build -t ui-showcase .
docker run -p 3000:3000 ui-showcase
```

### Self-hosted

```bash
pnpm build
pnpm start
```

## 🔗 Related Packages

- `@aiu/core` - Core types and utilities
- `@aiu/ui` - Headless UI components
- `@aiu/sdk` - Main SDK
- `@aiu/keyring` - Key management
- `@aiu/agents` - Agent framework

## 📝 License

MIT - See root LICENSE file

## 🤝 Contributing

Contributions welcome! Please see the main repository for guidelines.

---

Built with ❤️ using AI Unified SDK
