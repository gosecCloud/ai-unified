import { NextRequest, NextResponse } from 'next/server';

// In-memory store for demo purposes
// In a real app, this would connect to @aiu/keyring
interface StoredKey {
  alias: string;
  providerId: string;
  key: string; // In real app, this would be encrypted
  valid: boolean;
  scopes?: string[];
  createdAt: Date;
}

const keys: StoredKey[] = [
  {
    alias: 'default',
    providerId: 'openai',
    key: 'sk-demo-key',
    valid: true,
    scopes: ['chat', 'embed', 'image'],
    createdAt: new Date('2024-01-15'),
  },
  {
    alias: 'anthropic-prod',
    providerId: 'anthropic',
    key: 'sk-ant-demo',
    valid: true,
    scopes: ['chat'],
    createdAt: new Date('2024-02-01'),
  },
];

export async function GET() {
  // Return keys without the actual key values
  const safeKeys = keys.map(({ key, ...rest }) => rest);
  return NextResponse.json({ keys: safeKeys });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, key, alias } = body;

    if (!providerId || !key || !alias) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, key, alias' },
        { status: 400 }
      );
    }

    // Check for duplicate alias
    if (keys.some(k => k.alias === alias)) {
      return NextResponse.json(
        { error: 'Alias already exists' },
        { status: 409 }
      );
    }

    // Add new key
    const newKey: StoredKey = {
      alias,
      providerId,
      key,
      valid: true,
      scopes: ['chat', 'embed'],
      createdAt: new Date(),
    };

    keys.push(newKey);

    const { key: _, ...safeKey } = newKey;
    return NextResponse.json({ success: true, key: safeKey }, { status: 201 });
  } catch (error) {
    console.error('Keys API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alias = searchParams.get('alias');

    if (!alias) {
      return NextResponse.json(
        { error: 'Missing alias parameter' },
        { status: 400 }
      );
    }

    const index = keys.findIndex(k => k.alias === alias);
    if (index === -1) {
      return NextResponse.json(
        { error: 'Key not found' },
        { status: 404 }
      );
    }

    keys.splice(index, 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Keys API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
