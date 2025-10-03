/**
 * Google Gemini provider adapter
 *
 * Supports both AI Studio (API key) and Vertex AI (OAuth) authentication
 * Uses OpenAI-compatible Chat Completions API
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

// AI Studio base URL (OpenAI-compatible)
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

// Vertex AI base URL pattern (requires project and location)
// https://LOCATION-aiplatform.googleapis.com/v1beta1/projects/PROJECT_ID/locations/LOCATION/endpoints/openai

interface GoogleChatResponse {
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

interface GoogleChatStreamChunk {
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

interface GoogleEmbeddingResponse {
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

interface GoogleModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// Static model catalog with latest Gemini models (2025)
const GEMINI_MODELS: ModelInfo[] = [
  {
    providerId: 'google',
    modelId: 'gemini-2.5-flash',
    kind: 'chat',
    contextWindow: 1000000, // 1M tokens
    maxOutputTokens: 8192,
    modalities: ['text', 'image', 'audio', 'video'],
    deprecated: false,
    costPerInputToken: 0.000000075, // $0.075 per 1M tokens (estimated)
    costPerOutputToken: 0.0000003,  // $0.30 per 1M tokens (estimated)
  },
  {
    providerId: 'google',
    modelId: 'gemini-2.0-flash',
    kind: 'chat',
    contextWindow: 1000000, // 1M tokens
    maxOutputTokens: 8192,
    modalities: ['text', 'image', 'audio'],
    deprecated: false,
    costPerInputToken: 0.00000005, // $0.05 per 1M tokens (estimated)
    costPerOutputToken: 0.00000020, // $0.20 per 1M tokens (estimated)
  },
  {
    providerId: 'google',
    modelId: 'gemini-2.0-flash-001',
    kind: 'chat',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    modalities: ['text', 'image', 'audio'],
    deprecated: false,
    costPerInputToken: 0.00000005,
    costPerOutputToken: 0.00000020,
  },
  {
    providerId: 'google',
    modelId: 'gemini-1.5-pro',
    kind: 'chat',
    contextWindow: 2000000, // 2M tokens
    maxOutputTokens: 8192,
    modalities: ['text', 'image', 'audio', 'video'],
    deprecated: false,
    costPerInputToken: 0.000001, // $1.00 per 1M tokens
    costPerOutputToken: 0.000004, // $4.00 per 1M tokens
  },
  {
    providerId: 'google',
    modelId: 'gemini-1.5-flash',
    kind: 'chat',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    modalities: ['text', 'image', 'audio', 'video'],
    deprecated: false,
    costPerInputToken: 0.000000075,
    costPerOutputToken: 0.0000003,
  },
  {
    providerId: 'google',
    modelId: 'text-embedding-004',
    kind: 'embed',
    contextWindow: 2048,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.00000001, // $0.01 per 1M tokens
    costPerOutputToken: 0,
  },
];

export interface GoogleAdapterOptions {
  /**
   * Base URL override (for Vertex AI or custom deployments)
   */
  baseUrl?: string;

  /**
   * Vertex AI project ID (if using Vertex AI)
   */
  projectId?: string;

  /**
   * Vertex AI location/region (if using Vertex AI)
   */
  location?: string;
}

export class GoogleAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;
  private isVertexAI: boolean;

  constructor(options: GoogleAdapterOptions = {}) {
    this.http = new HttpClient({
      timeoutMs: 120000,
      maxRetries: 3,
      retryBaseMs: 1000,
    });

    // Determine if using Vertex AI or AI Studio
    this.isVertexAI = !!(options.projectId && options.location);

    if (this.isVertexAI) {
      this.baseUrl = options.baseUrl ||
        `https://${options.location}-aiplatform.googleapis.com/v1beta1/projects/${options.projectId}/locations/${options.location}/endpoints/openai`;
    } else {
      this.baseUrl = options.baseUrl || BASE_URL;
    }
  }

  info(): ProviderInfo {
    return {
      id: 'google',
      name: 'Google Gemini',
      supports: ['chat', 'embed'],
      endpoints: {
        chat: `${this.baseUrl}/chat/completions`,
        embed: `${this.baseUrl}/embeddings`,
        models: `${this.baseUrl}/models`,
      },
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 1000000,
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
      const response = await this.http.request<{ data: GoogleModel[] }>(
        `${this.baseUrl}/models`,
        {
          method: 'GET',
          headers: this.getHeaders(apiKey),
        }
      );

      // Merge live models with static catalog
      const liveModelIds = response.data.map((m) => m.id.replace('models/', ''));
      const staticModels = GEMINI_MODELS.filter((m) =>
        liveModelIds.includes(m.modelId) || m.modelId.startsWith('gemini-')
      );

      return staticModels;
    } catch (error: any) {
      // Fallback to static catalog if API fails
      return GEMINI_MODELS;
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
      const response = await this.http.request<GoogleChatResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: this.getHeaders(apiKey),
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
          headers: this.getHeaders(apiKey),
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

    const response = await this.http.request<GoogleEmbeddingResponse>(
      `${this.baseUrl}/embeddings`,
      {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body,
      }
    );

    return {
      providerId: 'google',
      modelId,
      embeddings: response.data.map((item) => item.embedding),
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  // Private helper methods

  private getHeaders(apiKey: string): Record<string, string> {
    if (this.isVertexAI) {
      // Vertex AI uses OAuth bearer token
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
    } else {
      // AI Studio uses x-goog-api-key header
      return {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      };
    }
  }

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
    if (options.top_k !== undefined) mapped.top_k = options.top_k;
    if (options.stop !== undefined) mapped.stop = options.stop;
    if (options.tools !== undefined) mapped.tools = options.tools;
    if (options.tool_choice !== undefined) mapped.tool_choice = options.tool_choice;

    return mapped;
  }

  private mapChatResponse(response: GoogleChatResponse): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw parsingError('No choices in response', 'google');
    }

    return {
      model: `google:${response.model}`,
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
    for await (const event of parseSSEJSON<GoogleChatStreamChunk>(stream)) {
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
