/**
 * Mistral AI provider adapter
 *
 * Supports OpenAI-compatible chat completions and embeddings
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  EmbedRequest,
  EmbedResponse,
  StreamChunk,
  ChatDelta,
  Message,
} from '@aiu/core';
import { HttpClient } from '@aiu/transport';
import { parseSSEJSON } from '@aiu/transport';
import { parsingError } from '@aiu/core';

const BASE_URL = 'https://api.mistral.ai/v1';

interface MistralChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MistralChatStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

interface MistralEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface MistralModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// Static model catalog with pricing (2025)
const MISTRAL_MODELS: ModelInfo[] = [
  {
    providerId: 'mistral',
    modelId: 'mistral-large-latest',
    kind: 'chat',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.000002,  // $2 per 1M tokens
    costPerOutputToken: 0.000006, // $6 per 1M tokens
  },
  {
    providerId: 'mistral',
    modelId: 'mistral-large-2411',
    kind: 'chat',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.000002,
    costPerOutputToken: 0.000006,
  },
  {
    providerId: 'mistral',
    modelId: 'mistral-medium-latest',
    kind: 'chat',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.0000027, // $2.7 per 1M tokens
    costPerOutputToken: 0.0000081, // $8.1 per 1M tokens
  },
  {
    providerId: 'mistral',
    modelId: 'mistral-small-latest',
    kind: 'chat',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.0000001,  // $0.1 per 1M tokens
    costPerOutputToken: 0.0000003, // $0.3 per 1M tokens
  },
  {
    providerId: 'mistral',
    modelId: 'codestral-latest',
    kind: 'chat',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.0000001,
    costPerOutputToken: 0.0000003,
  },
  {
    providerId: 'mistral',
    modelId: 'mistral-embed',
    kind: 'embed',
    contextWindow: 8192,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.0000001, // $0.1 per 1M tokens
    costPerOutputToken: 0,
  },
  {
    providerId: 'mistral',
    modelId: 'open-mistral-7b',
    kind: 'chat',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.00000025, // $0.25 per 1M tokens
    costPerOutputToken: 0.00000025,
  },
  {
    providerId: 'mistral',
    modelId: 'open-mixtral-8x7b',
    kind: 'chat',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.0000007,  // $0.7 per 1M tokens
    costPerOutputToken: 0.0000007,
  },
  {
    providerId: 'mistral',
    modelId: 'open-mixtral-8x22b',
    kind: 'chat',
    contextWindow: 64000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.000002,
    costPerOutputToken: 0.000006,
  },
];

export class MistralAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.http = new HttpClient({
      timeoutMs: 120000,
      maxRetries: 3,
      retryBaseMs: 1000,
    });
    this.baseUrl = baseUrl;
  }

  info(): ProviderInfo {
    return {
      id: 'mistral',
      name: 'Mistral AI',
      supports: ['chat', 'embed'],
      endpoints: {
        chat: `${this.baseUrl}/chat/completions`,
        embed: `${this.baseUrl}/embeddings`,
        models: `${this.baseUrl}/models`,
      },
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000,
      },
    };
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.listModels(apiKey);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Invalid API key',
      };
    }
  }

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const response = await this.http.request<{ data: MistralModel[] }>(
        `${this.baseUrl}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Merge live models with static catalog
      const liveModelIds = response.data.map((m) => m.id);
      const models = MISTRAL_MODELS.filter((m) => liveModelIds.includes(m.modelId));

      // If no matches, return all static models
      return models.length > 0 ? models : MISTRAL_MODELS;
    } catch (error: any) {
      // Fallback to static catalog if API fails
      return MISTRAL_MODELS;
    }
  }

  async chat(
    request: ChatRequest,
    apiKey: string
  ): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const modelId = this.parseModelId(request.model);
    const isStreaming = request.options?.stream ?? false;

    const body = {
      model: modelId,
      messages: this.mapMessages(request.input),
      ...this.mapChatOptions(request.options || {}),
    };

    if (!isStreaming) {
      // Non-streaming request
      const response = await this.http.request<MistralChatResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      return this.mapChatResponse(response);
    } else {
      // Streaming request
      const stream = await this.http.stream(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: { ...body, stream: true },
        }
      );

      return this.streamChat(stream as ReadableStream<Uint8Array>, modelId);
    }
  }

  async embed(request: EmbedRequest, apiKey: string): Promise<EmbedResponse> {
    const modelId = this.parseModelId(request.model);

    const body = {
      model: modelId,
      input: request.input,
      encoding_format: request.options?.encodingFormat || 'float',
    };

    const response = await this.http.request<MistralEmbeddingResponse>(
      `${this.baseUrl}/embeddings`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      }
    );

    return {
      providerId: 'mistral',
      modelId,
      embeddings: response.data.map((item) => item.embedding),
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  // Private helper methods

  private parseModelId(model: string): string {
    // Handle "provider:model" format
    if (model.includes(':')) {
      return model.split(':')[1]!;
    }
    return model;
  }

  private mapMessages(messages: Message[]): any[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));
  }

  private mapChatOptions(options: Record<string, any>): Record<string, any> {
    const mapped: Record<string, any> = {};

    if (options.temperature !== undefined) mapped.temperature = options.temperature;
    if (options.max_tokens !== undefined) mapped.max_tokens = options.max_tokens;
    if (options.top_p !== undefined) mapped.top_p = options.top_p;
    if (options.stop !== undefined) mapped.stop = options.stop;
    if (options.tools !== undefined) mapped.tools = options.tools;
    if (options.tool_choice !== undefined) mapped.tool_choice = options.tool_choice;
    if (options.safe_prompt !== undefined) mapped.safe_prompt = options.safe_prompt;
    if (options.random_seed !== undefined) mapped.random_seed = options.random_seed;

    return mapped;
  }

  private mapChatResponse(response: MistralChatResponse): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw parsingError('No choices in response', 'mistral');
    }

    return {
      model: `mistral:${response.model}`,
      id: response.id,
      created: response.created,
      output: {
        role: choice.message.role as 'assistant',
        content: choice.message.content,
        tool_calls: choice.message.tool_calls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | undefined,
    };
  }

  private async *streamChat(
    stream: ReadableStream<Uint8Array>,
    _modelId: string
  ): AsyncIterable<StreamChunk<ChatDelta>> {
    for await (const event of parseSSEJSON<MistralChatStreamChunk>(stream)) {
      if (!event.choices || event.choices.length === 0) continue;

      const choice = event.choices[0]!;
      const delta = choice.delta;

      yield {
        delta: {
          role: delta.role as 'assistant' | undefined,
          content: delta.content,
          tool_calls: delta.tool_calls
            ?.filter((tc) => tc.function?.name && tc.function?.arguments)
            .map((tc) => ({
              index: tc.index,
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function!.name!,
                arguments: tc.function!.arguments!,
              },
            })),
        },
      };
    }
  }
}
