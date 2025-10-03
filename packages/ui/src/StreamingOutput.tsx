/**
 * Streaming output component
 */

import React, { useState, useEffect } from 'react';
import type { StreamChunk, ChatDelta } from '@aiu/core';

export interface StreamingOutputProps {
  /** Async iterable stream */
  stream: AsyncIterable<StreamChunk<ChatDelta>> | null;
  /** Render prop */
  children: (props: {
    content: string;
    isStreaming: boolean;
    error?: Error;
  }) => React.ReactNode;
  /** Callback when streaming completes */
  onComplete?: (content: string) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Headless streaming output component
 */
export function StreamingOutput({ stream, children, onComplete, onError }: StreamingOutputProps) {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!stream) return;

    setContent('');
    setIsStreaming(true);
    setError(undefined);

    (async () => {
      let accumulated = ''; // Local accumulator to avoid stale closure
      try {
        for await (const chunk of stream) {
          if (chunk.delta.content) {
            accumulated += chunk.delta.content;
            setContent(accumulated);
          }
        }
        setIsStreaming(false);
        onComplete?.(accumulated); // Use local accumulator, not stale state
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setIsStreaming(false);
        onError?.(error);
      }
    })();
  }, [stream, onComplete, onError]);

  return <>{children({ content, isStreaming, error })}</>;
}
