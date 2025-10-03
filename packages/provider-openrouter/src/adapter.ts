/**
 * OpenRouter provider adapter
 *
 * OpenRouter provides unified access to 100+ models from multiple providers
 * OpenAI-compatible API with automatic fallback routing
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
import { badApiKeyError, parsingError } from '@aiu/core';

const BASE_URL = 'https://openrouter.ai/api/v1';

interface OpenRouterChatResponse {
  id: string;
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

interface OpenRouterChatStreamChunk {
  id: string;
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

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;    // Cost per token (as string)
    completion: string;
  };
  top_provider?: {
    context_length: number;
    max_completion_tokens?: number;
  };
}

export interface OpenRouterAdapterOptions {
  /**
   * OpenRouter site URL (for attribution)
   */
  siteUrl?: string;

  /**
   * OpenRouter app name (for attribution)
   */
  appName?: string;
}

export class OpenRouterAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;
  private siteUrl?: string;
  private appName?: string;

  constructor(options: OpenRouterAdapterOptions = {}) {
    this.http = new HttpClient({
      timeoutMs: 120000,
      maxRetries: 3,
      retryBaseMs: 1000,
    });
    this.baseUrl = BASE_URL;
    this.siteUrl = options.siteUrl;
    this.appName = options.appName;
  }

  info(): ProviderInfo {
    return {
      id: 'openrouter',
      name: 'OpenRouter',
      supports: ['chat'],
      endpoints: {
        chat: `${this.baseUrl}/chat/completions`,
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
      const response = await this.http.request<{ data: OpenRouterModel[] }>(
        `${this.baseUrl}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.map((model) => this.mapOpenRouterModel(model));
    } catch (error: any) {
      throw badApiKeyError('Failed to list models', 'openrouter');
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

    const headers = this.getHeaders(apiKey);

    if (!isStreaming) {
      // Non-streaming request
      const response = await this.http.request<OpenRouterChatResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers,
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
          headers,
          body: { ...body, stream: true },
        }
      );

      return this.streamChat(stream as ReadableStream<Uint8Array>, modelId);
    }
  }

  // Private helper methods

  private getHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Optional attribution headers
    if (this.siteUrl) {
      headers['HTTP-Referer'] = this.siteUrl;
    }
    if (this.appName) {
      headers['X-Title'] = this.appName;
    }

    return headers;
  }

  private parseModelId(model: string): string {
    // Handle "provider:model" format
    if (model.includes(':')) {
      return model.split(':')[1]!;
    }
    return model;
  }

  private mapOpenRouterModel(model: OpenRouterModel): ModelInfo {
    return {
      providerId: 'openrouter',
      modelId: model.id,
      kind: 'chat',
      contextWindow: model.context_length,
      maxOutputTokens: model.top_provider?.max_completion_tokens || 4096,
      modalities: ['text'],
      deprecated: false,
      costPerInputToken: parseFloat(model.pricing.prompt),
      costPerOutputToken: parseFloat(model.pricing.completion),
    };
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
    if (options.top_k !== undefined) mapped.top_k = options.top_k;
    if (options.stop !== undefined) mapped.stop = options.stop;
    if (options.presence_penalty !== undefined) mapped.presence_penalty = options.presence_penalty;
    if (options.frequency_penalty !== undefined) mapped.frequency_penalty = options.frequency_penalty;
    if (options.repetition_penalty !== undefined) mapped.repetition_penalty = options.repetition_penalty;
    if (options.tools !== undefined) mapped.tools = options.tools;
    if (options.tool_choice !== undefined) mapped.tool_choice = options.tool_choice;

    // OpenRouter-specific options
    if (options.provider !== undefined) {
      mapped.provider = options.provider; // Fallback provider preferences
    }
    if (options.route !== undefined) {
      mapped.route = options.route; // 'fallback' for automatic fallback
    }

    return mapped;
  }

  private mapChatResponse(response: OpenRouterChatResponse): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw parsingError('No choices in response', 'openrouter');
    }

    return {
      model: `openrouter:${response.model}`,
      id: response.id,
      created: Math.floor(Date.now() / 1000),
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
    for await (const event of parseSSEJSON<OpenRouterChatStreamChunk>(stream)) {
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
