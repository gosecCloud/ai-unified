'use client';

/**
 * Agent runner example page
 */

import { useState, useEffect } from 'react';
import type { AgentEvent } from '@aiu/core';
import { streamAgentEvents } from '@/lib/sse-client';

export default function AgentRunnerPage() {
  const [agentId, setAgentId] = useState('claude-code');
  const [task, setTask] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [agents, setAgents] = useState<any>(null);

  // Load agent info on mount
  useEffect(() => {
    fetch('/api/agent/detect')
      .then(res => res.json())
      .then(data => setAgents(data))
      .catch(console.error);
  }, []);

  const runAgent = async () => {
    if (!task) return;

    setIsRunning(true);
    setEvents([]);

    try {
      for await (const event of streamAgentEvents('/api/agent/run', {
        agentId,
        task,
        workspace: workspace || undefined,
      })) {
        setEvents(prev => [...prev, event]);

        if (event.type === 'task_complete' || event.type === 'error') {
          setIsRunning(false);
          break;
        }
      }
    } catch (error) {
      console.error('Agent execution error:', error);
      setIsRunning(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Agent Runner</h1>
      <p>Run autonomous coding agents directly from your browser</p>

      <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
        <div>
          <label htmlFor="agent" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Select Agent
          </label>
          <select
            id="agent"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
            disabled={isRunning}
          >
            <option value="claude-code">Claude Code</option>
            <option value="gemini-cli">Gemini CLI</option>
            <option value="codex">OpenAI Codex</option>
          </select>
          {agents && agents[agentId] && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Status: {agents[agentId].installed ? '✅ Installed' : '❌ Not installed'}
              {agents[agentId].authStatus && ` | Auth: ${agents[agentId].authStatus}`}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="task" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Task Description
          </label>
          <textarea
            id="task"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g., Create a hello world function in TypeScript"
            rows={4}
            style={{ width: '100%', padding: '0.5rem', fontFamily: 'inherit' }}
            disabled={isRunning}
          />
        </div>

        <div>
          <label htmlFor="workspace" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Workspace Path (optional)
          </label>
          <input
            id="workspace"
            type="text"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder="/path/to/workspace (defaults to server cwd)"
            style={{ width: '100%', padding: '0.5rem' }}
            disabled={isRunning}
          />
        </div>

        <button
          onClick={runAgent}
          disabled={isRunning || !task}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isRunning ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: isRunning || !task ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          {isRunning ? 'Running...' : 'Run Agent'}
        </button>
      </div>

      {events.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Event Stream</h2>
          <div
            style={{
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              padding: '1rem',
              borderRadius: '0.25rem',
              maxHeight: '400px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
          >
            {events.map((event, idx) => (
              <div key={idx} style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: getEventColor(event.type) }}>
                  [{event.type}]
                </span>{' '}
                {formatEventData(event)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getEventColor(type: string): string {
  switch (type) {
    case 'task_start':
      return '#4ade80';
    case 'task_complete':
      return '#22c55e';
    case 'error':
      return '#ef4444';
    case 'tool_use':
      return '#3b82f6';
    case 'file_edit':
      return '#f59e0b';
    case 'file_create':
      return '#10b981';
    case 'shell_exec':
      return '#06b6d4';
    case 'thinking':
      return '#9ca3af';
    default:
      return '#d4d4d4';
  }
}

function formatEventData(event: AgentEvent): string {
  const data = event.data as any;

  switch (event.type) {
    case 'task_start':
      return data.task || '';
    case 'task_complete':
      return `Completed in ${data.durationMs}ms (exit: ${data.exitCode})`;
    case 'error':
      return data.error || 'Unknown error';
    case 'tool_use':
      return data.tool || '';
    case 'file_edit':
    case 'file_create':
      return data.path || '';
    case 'shell_exec':
      return data.command || '';
    case 'thinking':
      return data.content || '';
    default:
      return JSON.stringify(data);
  }
}
