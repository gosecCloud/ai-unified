import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, model, stream } = await request.json();

    // Validate request
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    // Mock streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          const mockResponse = "This is a mock streaming response from the AI model. In a real implementation, this would connect to your AI provider SDK.";
          const words = mockResponse.split(' ');

          for (let i = 0; i < words.length; i++) {
            const chunk = {
              delta: { content: (i === 0 ? '' : ' ') + words[i] }
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            await new Promise(resolve => setTimeout(resolve, 50));
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
    }

    // Mock non-streaming response
    return NextResponse.json({
      content: `This is a mock response from ${model}. The last message was: "${messages[messages.length - 1].content}"`
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
