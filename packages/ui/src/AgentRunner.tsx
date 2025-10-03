/**
 * Agent runner component - headless UI for running agent tasks
 */

import React, { useState, useCallback } from 'react';
import type { AgentAdapter, AgentJob, AgentEvent } from '@aiu/core';

export interface AgentRunnerProps {
  /** Agent adapter to use */
  adapter: AgentAdapter;
  /** Render prop */
  children: (props: {
    isRunning: boolean;
    stream: AsyncIterable<AgentEvent> | null;
    runId: string | null;
    error?: Error;
    run: (job: Omit<AgentJob, 'id' | 'agentId' | 'status' | 'createdAt'>) => Promise<void>;
    cancel: () => Promise<void>;
  }) => React.ReactNode;
}

/**
 * Headless agent runner component
 */
export function AgentRunner({ adapter, children }: AgentRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [stream, setStream] = useState<AsyncIterable<AgentEvent> | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<Error | undefined>();

  const run = useCallback(
    async (jobInput: Omit<AgentJob, 'id' | 'agentId' | 'status' | 'createdAt'>) => {
      if (isRunning) {
        throw new Error('Agent is already running');
      }

      const newRunId = `run-${Date.now()}`;
      const agentInfo = adapter.info();

      const job: AgentJob = {
        id: `job-${Date.now()}`,
        agentId: agentInfo.id,
        status: 'running',
        createdAt: new Date(),
        ...jobInput,
      };

      setIsRunning(true);
      setRunId(newRunId);
      setError(undefined);

      try {
        const eventStream = adapter.execute(job);
        setStream(eventStream);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to start agent');
        setError(error);
        setIsRunning(false);
        setRunId(null);
      }
    },
    [adapter, isRunning]
  );

  const cancel = useCallback(async () => {
    if (!runId || !isRunning) {
      return;
    }

    try {
      await adapter.cancel(runId);
      setIsRunning(false);
      setStream(null);
      setRunId(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to cancel agent');
      setError(error);
    }
  }, [adapter, runId, isRunning]);

  return (
    <>
      {children({
        isRunning,
        stream,
        runId,
        error,
        run,
        cancel,
      })}
    </>
  );
}
