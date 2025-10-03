/**
 * API route for detecting installed agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { ClaudeCodeAdapter, GeminiCliAdapter, CodexAdapter } from '@aiu/agents';
import { createLogger } from '@aiu/observability';

const logger = createLogger({ level: 'info' });

const agentAdapters = {
  'claude-code': new ClaudeCodeAdapter(logger),
  'gemini-cli': new GeminiCliAdapter(logger),
  'codex': new CodexAdapter(logger),
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get('agent');

  try {
    const agentsToCheck = agentId ? [agentId] : Object.keys(agentAdapters);
    const results: Record<string, any> = {};

    for (const id of agentsToCheck) {
      const adapter = agentAdapters[id as keyof typeof agentAdapters];
      if (!adapter) {
        results[id] = { error: 'Unknown agent' };
        continue;
      }

      const info = adapter.info();
      const detection = await adapter.detect();

      let authStatus = null;
      if (detection.installed) {
        const auth = await adapter.validateAuth();
        authStatus = auth.valid ? 'valid' : auth.reason || 'invalid';
      }

      results[id] = {
        ...info,
        installed: detection.installed,
        detectedVersion: detection.version,
        detectedPath: detection.path,
        authStatus,
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Detection failed' },
      { status: 500 }
    );
  }
}
