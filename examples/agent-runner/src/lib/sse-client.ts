/**
 * SSE (Server-Sent Events) client utilities for streaming agent events
 */

import type { AgentEvent } from '@aiu/core';

export interface SSEClientOptions {
  onEvent?: (event: AgentEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/**
 * Create an async iterable from an SSE endpoint
 */
export async function* streamAgentEvents(
  url: string,
  body: any
): AsyncIterable<AgentEvent> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data) as AgentEvent;
            yield event;

            // Stop if we get a completion or error event
            if (event.type === 'task_complete' || event.type === 'error') {
              return;
            }
          } catch (e) {
            console.warn('Failed to parse SSE event:', data);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * React hook for consuming SSE agent events
 */
export function useAgentSSE(url: string, body: any, options: SSEClientOptions = {}) {
  const { onEvent, onError, onComplete } = options;

  const connect = async () => {
    try {
      for await (const event of streamAgentEvents(url, body)) {
        onEvent?.(event);

        if (event.type === 'task_complete' || event.type === 'error') {
          onComplete?.();
          break;
        }
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('SSE error'));
    }
  };

  return { connect };
}
