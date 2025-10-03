import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { agentId, task, workspaceId } = await request.json();

    // Validate request
    if (!agentId || !task) {
      return NextResponse.json({ error: 'Missing agentId or task' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
      async start(controller) {
        const events = [
          { type: 'task_start', message: `Starting ${agentId} agent` },
          { type: 'thinking', message: 'Analyzing task requirements...' },
          { type: 'tool_use', message: 'Reading workspace files', file: `${workspaceId}/package.json` },
          { type: 'file_edit', message: 'Updating configuration', file: `${workspaceId}/config.ts` },
          { type: 'shell_exec', message: 'Installing dependencies', command: 'pnpm install' },
          { type: 'progress', message: 'Task 50% complete' },
          { type: 'file_create', message: 'Created new file', file: `${workspaceId}/output.txt`, content: 'Task completed successfully!' },
          { type: 'task_complete', message: 'Agent task completed successfully' }
        ];

        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new NextResponse(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
