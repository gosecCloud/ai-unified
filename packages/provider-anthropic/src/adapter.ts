/**
 * Anthropic provider adapter
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ChatDelta,
  Message,
} from '@aiu/core';
import { HttpClient } from '@aiu/transport';
import { parseSSEJSON } from '@aiu/transport';
import { unsupportedFeatureError } from '@aiu/core';

const BASE_URL = 'https://api.anthropic.com/v1';
const API_VERSION = '2023-06-01';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; source?: any }>;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text?: string;
    stop_reason?: string;
  };
  content_block?: {
    type: string;
    text?: string;
  };
  message?: AnthropicResponse;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Static model definitions (Anthropic doesn't provide a models endpoint)
const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    providerId: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    kind: 'chat',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    modalities: ['text', 'image'],
    deprecated: false,
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
    kind: 'chat',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    modalities: ['text'],
    deprecated: false,
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-3-opus-20240229',
    kind: 'chat',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    modalities: ['text', 'image'],
    deprecated: false,
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-3-sonnet-20240229',
    kind: 'chat',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    modalities: ['text', 'image'],
    deprecated: false,
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    kind: 'chat',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    modalities: ['text', 'image'],
    deprecated: false,
  },
];

export class AnthropicAdapter implements ProviderAdapter {
  private http: HttpClient;

  constructor() {
    this.http = new HttpClient({
      timeoutMs: 120000,
      maxRetries: 3,
    });
  }

  info(): ProviderInfo {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      supports: ['chat'],
      endpoints: {
        chat: '/v1/messages',
      },
    };
  }

  async validateApiKey(key: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Anthropic doesn't have a dedicated validation endpoint, so we make a minimal request
      await this.http.request(
        `${BASE_URL}/messages`,
        {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': API_VERSION,
          },
          body: {
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          },
        },
        'anthropic'
      );
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listModels(_key: string): Promise<ModelInfo[]> {
    // Anthropic doesn't provide a models API, return static list
    return ANTHROPIC_MODELS;
  }

  async chat(req: ChatRequest, key: string): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    // Extract system messages
    const systemMessages = req.input.filter((m) => m.role === 'system');
    const nonSystemMessages = req.input.filter((m) => m.role !== 'system');

    const payload: any = {
      model: req.model.includes(':') ? req.model.split(':')[1] : req.model,
      messages: nonSystemMessages.map((msg) => this.mapMessage(msg)),
      max_tokens: req.options?.max_tokens ?? 4096,
      temperature: req.options?.temperature,
      top_p: req.options?.top_p,
      stream: req.options?.stream ?? false,
      stop_sequences: Array.isArray(req.options?.stop) ? req.options.stop : req.options?.stop ? [req.options.stop] : undefined,
    };

    // Add system message if present
    if (systemMessages.length > 0) {
      payload.system = systemMessages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
    }

    if (req.options?.stream) {
      return this.streamChat(payload, key);
    }

    const response = await this.http.request<AnthropicResponse>(
      `${BASE_URL}/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': API_VERSION,
        },
        body: payload,
      },
      'anthropic'
    );

    return this.mapChatResponse(response);
  }

  embed(): Promise<any> {
    throw unsupportedFeatureError('anthropic', 'embeddings');
  }

  private async *streamChat(payload: any, key: string): AsyncIterable<StreamChunk<ChatDelta>> {
    const stream = await this.http.stream(
      `${BASE_URL}/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': API_VERSION,
        },
        body: payload,
      },
      'anthropic'
    );

    for await (const event of parseSSEJSON<AnthropicStreamEvent>(stream)) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        const delta: ChatDelta = {
          content: event.delta.text,
        };
        yield { delta, raw: event };
      } else if (event.type === 'content_block_start' && event.content_block?.text) {
        const delta: ChatDelta = {
          role: 'assistant',
          content: event.content_block.text,
        };
        yield { delta, raw: event };
      }
    }
  }

  private mapMessage(msg: Message): AnthropicMessage {
    // Anthropic only supports user and assistant roles
    const role = msg.role === 'system' ? 'user' : (msg.role as 'user' | 'assistant');

    return {
      role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    };
  }

  private mapChatResponse(response: AnthropicResponse): ChatResponse {
    const textContent = response.content.find((c) => c.type === 'text');
    const content = textContent?.text ?? '';

    return {
      model: response.model,
      id: response.id,
      created: Date.now(),
      output: {
        role: 'assistant',
        content,
      },
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason as any,
      raw: response,
    };
  }
}
