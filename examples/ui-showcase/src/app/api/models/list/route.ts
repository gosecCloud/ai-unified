import { NextRequest, NextResponse } from 'next/server';
import type { ProviderAdapter } from '@aiu/core';

// Lazy-load provider adapters
const getAdapter = async (providerId: string): Promise<ProviderAdapter | null> => {
  try {
    switch (providerId) {
      case 'openai': {
        const { OpenAIAdapter } = await import('@aiu/provider-openai');
        return new OpenAIAdapter();
      }
      case 'anthropic': {
        const { AnthropicAdapter } = await import('@aiu/provider-anthropic');
        return new AnthropicAdapter();
      }
      // Add other providers as needed - currently only OpenAI and Anthropic are installed
      default:
        return null;
    }
  } catch (error) {
    console.error(`Failed to load adapter for ${providerId}:`, error);
    return null;
  }
};

// Mock keys for demo - in real app, fetch from /api/keys
const mockKeys: Record<string, string> = {
  openai: 'sk-demo',
  anthropic: 'sk-ant-demo',
  google: 'demo-key',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');

    if (!providerId) {
      return NextResponse.json(
        { error: 'Missing providerId parameter' },
        { status: 400 }
      );
    }

    const adapter = await getAdapter(providerId);
    if (!adapter) {
      return NextResponse.json(
        { error: `Provider not supported or not installed: ${providerId}` },
        { status: 404 }
      );
    }

    // Get API key from mock store
    const apiKey = mockKeys[providerId];
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key found for this provider' },
        { status: 403 }
      );
    }

    // Fetch models from provider
    const models = await adapter.listModels(apiKey);

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Models list API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch models',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
