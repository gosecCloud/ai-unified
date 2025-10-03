/**
 * Server-Sent Events (SSE) parser for streaming responses
 */

export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * Parse SSE stream into structured events
 */
export async function* parseSSE(stream: AsyncIterable<Uint8Array>): AsyncIterable<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent: Partial<SSEEvent> = {};

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');

    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      // Empty line indicates end of event
      if (line.trim() === '') {
        if (currentEvent.data !== undefined) {
          yield currentEvent as SSEEvent;
          currentEvent = {};
        }
        continue;
      }

      // Comment line
      if (line.startsWith(':')) {
        continue;
      }

      // Parse field
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const field = line.slice(0, colonIndex);
      let value = line.slice(colonIndex + 1);

      // Remove leading space
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }

      switch (field) {
        case 'event':
          currentEvent.event = value;
          break;
        case 'data':
          currentEvent.data = currentEvent.data ? `${currentEvent.data}\n${value}` : value;
          break;
        case 'id':
          currentEvent.id = value;
          break;
        case 'retry':
          const retry = parseInt(value, 10);
          if (!isNaN(retry)) {
            currentEvent.retry = retry;
          }
          break;
      }
    }
  }

  // Flush remaining data
  if (currentEvent.data !== undefined) {
    yield currentEvent as SSEEvent;
  }
}

/**
 * Parse JSON-formatted SSE data stream
 */
export async function* parseSSEJSON<T>(stream: AsyncIterable<Uint8Array>): AsyncIterable<T> {
  for await (const event of parseSSE(stream)) {
    if (event.data === '[DONE]') {
      break;
    }
    try {
      yield JSON.parse(event.data) as T;
    } catch {
      // Skip malformed JSON
      continue;
    }
  }
}
