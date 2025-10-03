# UI Showcase - Component Features

## 📋 Overview

The UI Showcase example demonstrates all AI Unified UI components with interactive demos and comprehensive documentation.

## 🎨 Components Included

### 1. **Chat Interface** (`/chat`)

A fully-featured chat UI with streaming support.

**Features:**
- ✅ Real-time streaming via Server-Sent Events (SSE)
- ✅ Message history with timestamps
- ✅ Multi-model selection (GPT-4, Claude, Gemini)
- ✅ Toggle between streaming and non-streaming modes
- ✅ Typing indicators and loading states
- ✅ Auto-scroll to latest message
- ✅ Enter key to send messages
- ✅ Responsive design

**API Integration:**
- `POST /api/chat` - Chat completion endpoint
- Supports both streaming and non-streaming responses
- Mock implementation included

**Code Example:**
```typescript
const sendMessage = async () => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, model, stream: true })
  });

  // Handle SSE stream
  const reader = response.body.getReader();
  // ... streaming logic
};
```

---

### 2. **Agent Monitor** (`/agent`)

Real-time monitoring dashboard for autonomous coding agents.

**Features:**
- ✅ Live event stream visualization
- ✅ 8 event types with color coding
- ✅ Task progress tracking
- ✅ File operation display
- ✅ Shell command logs
- ✅ Artifact preview
- ✅ Agent type selection (Claude Code, Gemini CLI, Codex)
- ✅ Workspace path configuration

**Event Types:**
1. `task_start` 🚀 - Agent initialization
2. `thinking` 🤔 - Processing phase
3. `tool_use` 🔧 - Tool execution
4. `file_edit` ✏️ - File modifications
5. `file_create` 📝 - New file creation
6. `shell_exec` 💻 - Command execution
7. `progress` ⏳ - Task updates
8. `task_complete` ✅ - Completion
9. `error` ❌ - Error handling

**API Integration:**
- `POST /api/agent/run` - Execute agent with SSE streaming
- Returns event stream for real-time monitoring

**Code Example:**
```typescript
const runAgent = async () => {
  const response = await fetch('/api/agent/run', {
    method: 'POST',
    body: JSON.stringify({ agentId, task, workspaceId })
  });

  // Parse SSE events
  const lines = chunk.split('\n\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      setEvents(prev => [...prev, event]);
    }
  }
};
```

---

### 3. **Model Selector** (`/models`)

Browse and filter AI models from 13+ providers.

**Features:**
- ✅ Real-time search across models and providers
- ✅ Filter by provider (OpenAI, Anthropic, Google, etc.)
- ✅ Filter by kind (chat, embedding, image, audio)
- ✅ Display model metadata:
  - Context window size
  - Max output tokens
  - Supported modalities
  - Cost per input/output token
- ✅ Model selection functionality
- ✅ Responsive grid layout
- ✅ Loading states

**Supported Providers:**
1. OpenAI
2. Anthropic (Claude)
3. Google (Gemini)
4. Azure OpenAI
5. Cohere
6. Ollama
7. Mistral AI
8. Stability AI
9. ElevenLabs
10. AssemblyAI
11. Jina AI
12. OpenRouter
13. vLLM

**Code Example:**
```typescript
const filterModels = () => {
  let filtered = [...models];

  if (selectedProvider !== 'all') {
    filtered = filtered.filter(m => m.providerId === selectedProvider);
  }

  if (selectedKind !== 'all') {
    filtered = filtered.filter(m => m.kind === selectedKind);
  }

  if (searchQuery) {
    filtered = filtered.filter(m =>
      m.modelId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  setFilteredModels(filtered);
};
```

---

### 4. **Keyring Manager** (`/keyring`)

Secure API key management with encryption.

**Features:**
- ✅ AES-256-GCM encryption
- ✅ Add new API keys with validation
- ✅ Provider selection dropdown
- ✅ Key alias management
- ✅ Real-time key validation
- ✅ Scope detection and display
- ✅ Delete key functionality
- ✅ Security best practices guide
- ✅ Visual status indicators (valid/invalid)

**Security Features:**
- 🔒 Encrypted storage
- ✓ Key validation
- 🔄 Rotation support
- 🛡️ Scope management
- 📅 Creation date tracking

**Code Example:**
```typescript
const addKey = async () => {
  setValidating(true);

  // Validate key with provider
  const response = await fetch('/api/keys/validate', {
    method: 'POST',
    body: JSON.stringify({
      alias: newKey.alias,
      providerId: newKey.providerId,
      key: newKey.key
    })
  });

  const { valid, scopes } = await response.json();

  if (valid) {
    setKeys([...keys, { alias, providerId, valid, scopes }]);
  }
};
```

---

## 🏗️ Architecture

### Project Structure

```
examples/ui-showcase/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with navigation
│   │   ├── page.tsx             # Home page with overview
│   │   ├── globals.css          # Global styles
│   │   ├── chat/
│   │   │   └── page.tsx         # Chat interface demo
│   │   ├── agent/
│   │   │   └── page.tsx         # Agent monitor demo
│   │   ├── models/
│   │   │   └── page.tsx         # Model selector demo
│   │   ├── keyring/
│   │   │   └── page.tsx         # Keyring manager demo
│   │   └── api/
│   │       ├── chat/
│   │       │   └── route.ts     # Chat API endpoint
│   │       └── agent/
│   │           └── run/
│   │               └── route.ts # Agent execution endpoint
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── postcss.config.js
├── README.md
└── FEATURES.md (this file)
```

### Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3
- **UI Components:** Custom headless components
- **SDK:** AI Unified packages
- **Streaming:** Server-Sent Events (SSE)

### Package Dependencies

```json
{
  "@aiu/core": "workspace:*",
  "@aiu/ui": "workspace:*",
  "@aiu/sdk": "workspace:*",
  "@aiu/keyring": "workspace:*",
  "@aiu/storage": "workspace:*",
  "@aiu/observability": "workspace:*",
  "@aiu/model-registry": "workspace:*",
  "@aiu/agents": "workspace:*",
  "@aiu/provider-anthropic": "workspace:*",
  "@aiu/provider-openai": "workspace:*"
}
```

---

## 🎯 Key Features

### 1. **Server-Sent Events (SSE)**

All real-time features use SSE for streaming:

```typescript
// Server (API route)
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    controller.close();
  }
});

return new NextResponse(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});

// Client
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      // Handle event
    }
  }
}
```

### 2. **Responsive Design**

All pages are mobile-responsive:
- Responsive grid layouts
- Mobile-friendly navigation
- Touch-optimized interactions
- Adaptive font sizes

### 3. **Type Safety**

Full TypeScript coverage:
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentEvent {
  type: string;
  message?: string;
  file?: string;
  command?: string;
  content?: string;
  timestamp: Date;
}

interface ModelInfo {
  providerId: string;
  modelId: string;
  kind: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  modalities: string[];
  deprecated: boolean;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}
```

### 4. **Error Handling**

Comprehensive error handling:
- Try-catch blocks for all async operations
- User-friendly error messages
- Fallback UI states
- Loading indicators

---

## 🚀 Getting Started

### Installation

```bash
cd examples/ui-showcase
pnpm install
```

### Development

```bash
pnpm dev
# Open http://localhost:3000
```

### Production Build

```bash
pnpm build
pnpm start
```

### Build Output

```
Route (app)                              Size     First Load JS
┌ ○ /                                    176 B            94 kB
├ ○ /agent                               2.19 kB        89.2 kB
├ ○ /chat                                2.13 kB        89.2 kB
├ ○ /keyring                             2.29 kB        89.3 kB
├ ○ /models                              2.11 kB        89.2 kB
├ ƒ /api/agent/run                       0 B                0 B
└ ƒ /api/chat                            0 B                0 B

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

---

## 🎨 Customization

### Theming

Colors are defined in `globals.css`:

```css
:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 249, 250, 251;
  --background-end-rgb: 255, 255, 255;
}
```

### Tailwind Configuration

Customize in `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      // Add custom colors
    },
    animation: {
      // Add custom animations
    },
  },
}
```

### Component Styles

Each page uses consistent color schemes:
- **Blue:** Chat interface (primary)
- **Purple:** Agent monitor
- **Indigo:** Model selector
- **Green:** Keyring manager

---

## 📊 Performance

### Optimization Features

1. **Code Splitting**
   - Automatic route-based splitting
   - Dynamic imports for heavy components

2. **Static Generation**
   - Home page pre-rendered
   - Component pages pre-rendered
   - Fast initial load

3. **Streaming**
   - SSE for real-time updates
   - Progressive rendering
   - No page reloads

4. **Bundle Size**
   - First Load JS: ~87-94 KB
   - Individual pages: 2-3 KB
   - Optimized with Next.js compiler

---

## 🧪 Testing Guide

### Manual Testing

1. **Chat Interface:**
   - Send messages
   - Toggle streaming
   - Change models
   - Clear history

2. **Agent Monitor:**
   - Start agent task
   - Observe events
   - Check file operations
   - Verify completion

3. **Model Selector:**
   - Search models
   - Filter providers
   - Filter kinds
   - Select model

4. **Keyring Manager:**
   - Add API key
   - Validate key
   - View scopes
   - Delete key

### Integration Testing

Connect to real AI providers:

```typescript
// Replace mock in /api/chat/route.ts
import { AIU } from '@aiu/sdk';

const aiu = new AIU({ /* config */ });
const response = await aiu.chat({ input: messages, model });
```

---

## 📚 Resources

- [AI Unified Documentation](../../README.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

## 🤝 Contributing

To add new component demos:

1. Create page in `src/app/[name]/page.tsx`
2. Add API route if needed
3. Update navigation in `layout.tsx`
4. Add to home page grid
5. Document in README.md

---

Built with ❤️ using AI Unified SDK
