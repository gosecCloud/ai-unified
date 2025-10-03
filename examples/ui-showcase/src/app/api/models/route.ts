import { NextRequest, NextResponse } from 'next/server';
import type { ModelInfo } from '@aiu/core';

// In-memory store for demo purposes
// In a real app, this would connect to @aiu/model-registry
const models: ModelInfo[] = [];

export async function GET() {
  return NextResponse.json({ models });
}

export async function POST(request: NextRequest) {
  try {
    const model: ModelInfo = await request.json();

    // Validate required fields
    if (!model.providerId || !model.modelId || !model.kind) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, modelId, kind' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const exists = models.some(
      m => m.providerId === model.providerId && m.modelId === model.modelId
    );

    if (exists) {
      return NextResponse.json(
        { error: 'Model already exists' },
        { status: 409 }
      );
    }

    // Add model
    models.push(model);

    return NextResponse.json({ success: true, model }, { status: 201 });
  } catch (error) {
    console.error('Model API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
