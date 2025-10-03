/**
 * API route for running agent tasks with SSE streaming
 */

import { NextRequest } from 'next/server';
import { ClaudeCodeAdapter, GeminiCliAdapter, CodexAdapter } from '@aiu/agents';
import type { AgentJob } from '@aiu/core';
import { createLogger } from '@aiu/observability';

const logger = createLogger({ level: 'info' });

const agentAdapters = {
  'claude-code': new ClaudeCodeAdapter(logger),
  'gemini-cli': new GeminiCliAdapter(logger),
  'codex': new CodexAdapter(logger),
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, task, workspace, contextFiles, profile } = body;

    if (!agentId || !task) {
      return new Response(
        JSON.stringify({ error: 'agentId and task are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const adapter = agentAdapters[agentId as keyof typeof agentAdapters];
    if (!adapter) {
      return new Response(
        JSON.stringify({ error: `Unknown agent: ${agentId}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const job: AgentJob = {
          id: `job-${Date.now()}`,
          agentId,
          task,
          workspaceId: workspace || process.cwd(),
          contextFiles: contextFiles || [],
          profile: profile || {
            name: 'api-run',
            allowNetwork: true,
            allowShell: true,
            timeoutMs: 300000,
          },
          status: 'running',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          for await (const event of adapter.execute(job)) {
            const eventData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(eventData));

            // End stream on completion or error
            if (event.type === 'task_complete' || event.type === 'error') {
              controller.close();
              break;
            }
          }
        } catch (error) {
          const errorEvent = {
            type: 'error',
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
