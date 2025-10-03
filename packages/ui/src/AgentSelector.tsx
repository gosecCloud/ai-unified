/**
 * Agent selector component - headless UI for selecting coding agents
 */

import React, { useState, useEffect } from 'react';
import type { AgentAdapter } from '@aiu/core';

export interface AgentInfo {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
  installed: boolean;
  authenticated: boolean;
  binaryPath?: string;
  detectedVersion?: string;
}

export interface AgentSelectorProps {
  /** Available agent adapters */
  agents: Record<string, AgentAdapter>;
  /** Selected agent ID */
  selectedAgent?: string;
  /** Callback when agent selection changes */
  onSelect?: (agentId: string) => void;
  /** Auto-detect installation status */
  autoDetect?: boolean;
  /** Render prop */
  children: (props: {
    agents: AgentInfo[];
    selectedAgent?: string;
    isDetecting: boolean;
    select: (agentId: string) => void;
  }) => React.ReactNode;
}

/**
 * Headless agent selector component
 */
export function AgentSelector({
  agents,
  selectedAgent,
  onSelect,
  autoDetect = true,
  children,
}: AgentSelectorProps) {
  const [agentInfos, setAgentInfos] = useState<AgentInfo[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    const detectAgents = async () => {
      setIsDetecting(true);

      const infos: AgentInfo[] = [];

      for (const [agentId, adapter] of Object.entries(agents)) {
        const info = adapter.info();
        let installed = false;
        let authenticated = false;
        let detectedVersion: string | undefined;

        if (autoDetect) {
          try {
            const detection = await adapter.detect();
            installed = detection.installed;
            detectedVersion = detection.version;

            if (installed) {
              const authResult = await adapter.validateAuth();
              authenticated = authResult.valid;
            }
          } catch (error) {
            // Detection failed, mark as not installed
            installed = false;
          }
        }

        infos.push({
          id: agentId,
          name: info.name,
          version: info.version,
          capabilities: info.capabilities,
          installed,
          authenticated,
          binaryPath: info.binaryPath,
          detectedVersion,
        });
      }

      setAgentInfos(infos);
      setIsDetecting(false);
    };

    detectAgents();
  }, [agents, autoDetect]);

  const select = (agentId: string) => {
    onSelect?.(agentId);
  };

  return (
    <>
      {children({
        agents: agentInfos,
        selectedAgent,
        isDetecting,
        select,
      })}
    </>
  );
}
