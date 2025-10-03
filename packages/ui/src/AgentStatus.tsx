/**
 * Agent status component - headless UI for displaying agent run status
 */

import React, { useState, useEffect } from 'react';
import type { AgentAdapter, AgentRunResult } from '@aiu/core';

export interface AgentStatusProps {
  /** Agent adapter */
  adapter: AgentAdapter;
  /** Run ID to monitor */
  runId: string;
  /** Polling interval in ms */
  pollInterval?: number;
  /** Render prop */
  children: (props: {
    status: AgentRunResult | null;
    isLoading: boolean;
    error?: Error;
    refresh: () => Promise<void>;
  }) => React.ReactNode;
}

/**
 * Headless agent status component
 */
export function AgentStatus({
  adapter,
  runId,
  pollInterval = 1000,
  children,
}: AgentStatusProps) {
  const [status, setStatus] = useState<AgentRunResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const refresh = async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const result = await adapter.getRunStatus(runId);
      setStatus(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get status');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    refresh();

    // Set up polling if status is running
    const interval = setInterval(() => {
      if (status?.status === 'running') {
        refresh();
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [runId, status?.status, pollInterval]);

  return <>{children({ status, isLoading, error, refresh })}</>;
}
