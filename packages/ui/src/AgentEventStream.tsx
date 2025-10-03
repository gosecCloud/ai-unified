/**
 * Agent event stream component - headless UI for streaming agent events
 */

import React, { useState, useEffect } from 'react';
import type { AgentEvent } from '@aiu/core';

export interface AgentEventStreamProps {
  /** Async iterable event stream */
  stream: AsyncIterable<AgentEvent> | null;
  /** Maximum events to keep in memory */
  maxEvents?: number;
  /** Render prop */
  children: (props: {
    events: AgentEvent[];
    isStreaming: boolean;
    error?: Error;
    latestEvent?: AgentEvent;
  }) => React.ReactNode;
  /** Callback when streaming completes */
  onComplete?: (events: AgentEvent[]) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback for each event */
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Headless agent event stream component
 */
export function AgentEventStream({
  stream,
  maxEvents = 1000,
  children,
  onComplete,
  onError,
  onEvent,
}: AgentEventStreamProps) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [latestEvent, setLatestEvent] = useState<AgentEvent | undefined>();

  useEffect(() => {
    if (!stream) return;

    setEvents([]);
    setIsStreaming(true);
    setError(undefined);
    setLatestEvent(undefined);

    (async () => {
      const collectedEvents: AgentEvent[] = [];

      try {
        for await (const event of stream) {
          collectedEvents.push(event);
          setLatestEvent(event);

          // Keep only the last maxEvents
          const eventsToKeep = collectedEvents.slice(-maxEvents);
          setEvents([...eventsToKeep]);

          onEvent?.(event);

          // Stop streaming if we get a completion or error event
          if (event.type === 'task_complete' || event.type === 'error') {
            break;
          }
        }

        setIsStreaming(false);
        onComplete?.(collectedEvents);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Stream error');
        setError(error);
        setIsStreaming(false);
        onError?.(error);
      }
    })();
  }, [stream, maxEvents, onComplete, onError, onEvent]);

  return <>{children({ events, isStreaming, error, latestEvent })}</>;
}
