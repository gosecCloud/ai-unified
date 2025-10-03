import Link from 'next/link';

export default function Home() {
  const components = [
    {
      name: 'Chat Interface',
      description: 'Interactive chat UI with streaming support, markdown rendering, and tool calls',
      href: '/chat',
      icon: '💬',
      features: ['Streaming responses', 'Markdown support', 'Tool execution', 'Message history']
    },
    {
      name: 'Agent Monitor',
      description: 'Real-time monitoring of autonomous coding agents with event streaming',
      href: '/agent',
      icon: '🤖',
      features: ['Live event stream', 'Task progress', 'Artifact display', 'Error handling']
    },
    {
      name: 'Model Selector',
      description: 'Browse and select AI models from multiple providers with filtering',
      href: '/models',
      icon: '🎯',
      features: ['Multi-provider', 'Model metadata', 'Capability filtering', 'Cost display']
    },
    {
      name: 'Keyring Manager',
      description: 'Secure API key management with encryption and validation',
      href: '/keyring',
      icon: '🔐',
      features: ['Key validation', 'Secure storage', 'Provider scopes', 'Key rotation']
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold text-gray-900">
          AI Unified UI Components
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Explore our comprehensive collection of headless React components for building
          AI-powered applications. Each component is fully typed, accessible, and production-ready.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        {components.map((component) => (
          <Link
            key={component.name}
            href={component.href}
            className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all"
          >
            <div className="flex items-start space-x-4">
              <div className="text-4xl">{component.icon}</div>
              <div className="flex-1 space-y-3">
                <h3 className="text-xl font-semibold text-gray-900">
                  {component.name}
                </h3>
                <p className="text-gray-600">
                  {component.description}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {component.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* SDK Features */}
      <div className="mt-16 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          Core SDK Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">🔌 13 AI Providers</h4>
            <p className="text-sm text-gray-600">
              OpenAI, Anthropic, Google, Azure, Cohere, Ollama, and more
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">🎨 Headless Components</h4>
            <p className="text-sm text-gray-600">
              Unstyled, accessible, and fully customizable UI primitives
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">🔒 Type-Safe</h4>
            <p className="text-sm text-gray-600">
              Full TypeScript support with strict mode enabled
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">📊 Observability</h4>
            <p className="text-sm text-gray-600">
              Built-in logging, metrics, and request tracing
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">🤖 Autonomous Agents</h4>
            <p className="text-sm text-gray-600">
              Claude Code, Gemini CLI, and OpenAI Codex adapters
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">💾 Persistent Storage</h4>
            <p className="text-sm text-gray-600">
              Prisma-based storage for models, keys, and request logs
            </p>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="mt-12 p-6 bg-white rounded-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Quick Start
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Install the SDK:</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <code>pnpm add @aiu/sdk @aiu/ui</code>
            </pre>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Use a component:</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import { ChatInterface } from '@aiu/ui';

export default function ChatPage() {
  return (
    <ChatInterface>
      {({ messages, sendMessage, isLoading }) => (
        <div>
          {messages.map(msg => (
            <div key={msg.id}>{msg.content}</div>
          ))}
        </div>
      )}
    </ChatInterface>
  );
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
