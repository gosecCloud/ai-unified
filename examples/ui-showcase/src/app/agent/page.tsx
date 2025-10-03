'use client';

import { useState } from 'react';

interface AgentEvent {
  type: string;
  message?: string;
  file?: string;
  command?: string;
  content?: string;
  timestamp: Date;
}

export default function AgentPage() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [task, setTask] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [agentType, setAgentType] = useState('claude-code');
  const [workspace, setWorkspace] = useState('/tmp/agent-workspace');

  const runAgent = async () => {
    if (!task.trim() || isRunning) return;

    setEvents([]);
    setIsRunning(true);

    try {
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentType,
          task,
          workspaceId: workspace,
          contextFiles: []
        })
      });

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);
                setEvents(prev => [...prev, { ...event, timestamp: new Date() }]);
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Agent error:', error);
      setEvents(prev => [...prev, {
        type: 'error',
        message: 'Failed to run agent',
        timestamp: new Date()
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      'task_start': '🚀',
      'thinking': '🤔',
      'tool_use': '🔧',
      'file_edit': '✏️',
      'file_create': '📝',
      'shell_exec': '💻',
      'progress': '⏳',
      'task_complete': '✅',
      'error': '❌'
    };
    return icons[type] || '📌';
  };

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      'task_start': 'bg-blue-50 border-blue-200 text-blue-900',
      'thinking': 'bg-purple-50 border-purple-200 text-purple-900',
      'tool_use': 'bg-yellow-50 border-yellow-200 text-yellow-900',
      'file_edit': 'bg-green-50 border-green-200 text-green-900',
      'file_create': 'bg-green-50 border-green-200 text-green-900',
      'shell_exec': 'bg-gray-50 border-gray-200 text-gray-900',
      'progress': 'bg-indigo-50 border-indigo-200 text-indigo-900',
      'task_complete': 'bg-emerald-50 border-emerald-200 text-emerald-900',
      'error': 'bg-red-50 border-red-200 text-red-900'
    };
    return colors[type] || 'bg-gray-50 border-gray-200 text-gray-900';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Agent Monitor</h2>
        <p className="text-gray-600 mt-2">
          Real-time monitoring of autonomous coding agents with event streaming
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent Type
            </label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="claude-code">Claude Code</option>
              <option value="gemini-cli">Gemini CLI</option>
              <option value="codex">OpenAI Codex</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workspace Path
            </label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Description
          </label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            disabled={isRunning}
            rows={3}
            placeholder="Describe the task for the agent to perform..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <button
          onClick={runAgent}
          disabled={isRunning || !task.trim()}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isRunning ? 'Running Agent...' : 'Run Agent'}
        </button>
      </div>

      {/* Event Stream */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Event Stream {events.length > 0 && `(${events.length} events)`}
          </h3>
        </div>
        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-lg">No events yet</p>
              <p className="text-sm mt-1">Run an agent to see events appear here</p>
            </div>
          ) : (
            events.map((event, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-4 ${getEventColor(event.type)} message-enter`}
              >
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold capitalize">
                        {event.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs opacity-75">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {event.message && (
                      <p className="text-sm mt-1">{event.message}</p>
                    )}
                    {event.file && (
                      <p className="text-sm mt-1 font-mono bg-white bg-opacity-50 px-2 py-1 rounded">
                        📁 {event.file}
                      </p>
                    )}
                    {event.command && (
                      <pre className="text-sm mt-1 font-mono bg-white bg-opacity-50 px-2 py-1 rounded overflow-x-auto">
                        $ {event.command}
                      </pre>
                    )}
                    {event.content && (
                      <pre className="text-sm mt-2 bg-white bg-opacity-50 px-2 py-1 rounded max-h-32 overflow-y-auto">
                        {event.content}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Features */}
      <div className="bg-purple-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          AgentMonitor Component Features
        </h3>
        <ul className="grid grid-cols-2 gap-3 text-sm text-gray-700">
          <li className="flex items-center space-x-2">
            <span className="text-purple-600">✓</span>
            <span>Real-time event streaming</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="text-purple-600">✓</span>
            <span>Task progress visualization</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="text-purple-600">✓</span>
            <span>File operation tracking</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="text-purple-600">✓</span>
            <span>Shell command execution logs</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="text-purple-600">✓</span>
            <span>Artifact display</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="text-purple-600">✓</span>
            <span>Error handling and recovery</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
