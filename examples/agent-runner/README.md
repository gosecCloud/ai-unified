# Agent Runner Example

A Next.js application demonstrating how to integrate autonomous coding agents with real-time event streaming.

## Features

- 🤖 Support for multiple coding agents (Claude Code, Gemini CLI, OpenAI Codex)
- 🔄 Real-time event streaming via Server-Sent Events (SSE)
- 🎨 Clean UI for agent selection and task execution
- 📊 Live event visualization with color-coded output
- 🔐 Agent detection and authentication validation

## Architecture

### API Routes

- **`/api/agent/detect`** - Detects installed agents and validates authentication
- **`/api/agent/run`** - Executes agent tasks with SSE streaming

### Components

- **AgentSelector** - Headless component for agent selection (from `@aiu/ui`)
- **AgentEventStream** - Headless component for event streaming (from `@aiu/ui`)
- **AgentRunner** - Headless component for task execution (from `@aiu/ui`)

### SSE Client

The `sse-client.ts` utility provides:
- Async iterable stream from SSE endpoint
- Automatic reconnection handling
- Event parsing and type safety

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```

3. Configure environment variables:
   ```env
   ANTHROPIC_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here
   GOOGLE_API_KEY=your_key_here
   ```

4. Ensure agent CLIs are installed:
   ```bash
   # For Claude Code
   npm install -g @anthropic-ai/claude-code

   # For Gemini CLI
   npm install -g @google/gemini-cli

   # For OpenAI Codex
   npm install -g openai-codex
   ```

## Usage

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running an Agent

1. Select an agent from the dropdown
2. Enter a task description (e.g., "Create a hello world function in TypeScript")
3. Optionally specify a workspace path
4. Click "Run Agent"
5. Watch the real-time event stream

### Event Types

- **task_start** - Agent has started the task
- **thinking** - Agent is processing/thinking
- **tool_use** - Agent is using a tool
- **file_edit** - Agent is editing a file
- **file_create** - Agent is creating a new file
- **shell_exec** - Agent is executing a shell command
- **task_complete** - Task completed successfully
- **error** - An error occurred

## Integration Examples

### Using the Headless Components

```tsx
import { AgentRunner, AgentEventStream } from '@aiu/ui';
import { ClaudeCodeAdapter } from '@aiu/agents';

function MyAgentUI() {
  const adapter = new ClaudeCodeAdapter();

  return (
    <AgentRunner adapter={adapter}>
      {({ run, stream, isRunning }) => (
        <div>
          <button onClick={() => run({ task: 'Create a test', workspaceId: '/workspace' })}>
            Run
          </button>

          {stream && (
            <AgentEventStream stream={stream}>
              {({ events, latestEvent }) => (
                <div>
                  {events.map((event, idx) => (
                    <div key={idx}>{event.type}: {JSON.stringify(event.data)}</div>
                  ))}
                </div>
              )}
            </AgentEventStream>
          )}
        </div>
      )}
    </AgentRunner>
  );
}
```

### Using the SSE Client Directly

```tsx
import { streamAgentEvents } from '@/lib/sse-client';

async function runAgent() {
  for await (const event of streamAgentEvents('/api/agent/run', {
    agentId: 'claude-code',
    task: 'Create a hello world function',
  })) {
    console.log(event);
  }
}
```

## Production Deployment

1. Build the application:
   ```bash
   pnpm build
   ```

2. Start the production server:
   ```bash
   pnpm start
   ```

## Security Considerations

- Agent CLIs must be installed on the server
- API keys should be stored securely in environment variables
- Workspace paths should be validated and sandboxed
- Consider rate limiting for the agent execution endpoint
- Implement authentication for production use

## License

MIT
