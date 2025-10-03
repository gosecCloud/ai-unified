/**
 * vLLM provider adapter
 *
 * vLLM provides OpenAI-compatible API for self-hosted inference
 * Supports high-throughput serving of custom models
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
import { modelNotFoundError, parsingError } from '@aiu/core';

interface VLLMChatResponse {
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

interface VLLMChatStreamChunk {
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

interface VLLMEmbeddingResponse {
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

interface VLLMModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface VLLMAdapterOptions {
  /**
   * Base URL for vLLM server (e.g., http://localhost:8000)
   */
  baseUrl: string;

  /**
   * Optional API key for authenticated vLLM deployments
   */
  apiKey?: string;

  /**
   * Default model name (if vLLM server hosts a single model)
   */
  defaultModel?: string;
}

export class VLLMAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;
  private defaultApiKey?: string;
  private defaultModel?: string;

  constructor(options: VLLMAdapterOptions) {
    this.http = new HttpClient({
      timeoutMs: 180000, // 3 minutes for large models
      maxRetries: 3,
      retryBaseMs: 1000,
    });
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultApiKey = options.apiKey;
    this.defaultModel = options.defaultModel;
  }

  info(): ProviderInfo {
    return {
      id: 'vllm',
      name: 'vLLM (Self-Hosted)',
      supports: ['chat', 'embed'],
      endpoints: {
        chat: `${this.baseUrl}/v1/chat/completions`,
        embed: `${this.baseUrl}/v1/embeddings`,
        models: `${this.baseUrl}/v1/models`,
      },
      rateLimit: {
        requestsPerMinute: 1000, // Depends on deployment
        tokensPerMinute: 1000000,
      },
    };
  }

  async validateApiKey(apiKey?: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.listModels(apiKey);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'vLLM server not reachable',
      };
    }
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    try {
      const response = await this.http.request<{ data: VLLMModel[] }>(
        `${this.baseUrl}/v1/models`,
        {
          method: 'GET',
          headers: this.getHeaders(apiKey),
        }
      );

      return response.data.map((model) => ({
        providerId: 'vllm',
        modelId: model.id,
        kind: 'chat' as const,
        contextWindow: 32000, // Default estimate
        maxOutputTokens: 4096,
        modalities: ['text'],
        deprecated: false,
        costPerInputToken: 0, // Self-hosted, no cost per token
        costPerOutputToken: 0,
      }));
    } catch (error: any) {
      // If model listing fails but we have a default model, return it
      if (this.defaultModel) {
        return [
          {
            providerId: 'vllm',
            modelId: this.defaultModel,
            kind: 'chat',
            contextWindow: 32000,
            maxOutputTokens: 4096,
            modalities: ['text'],
            deprecated: false,
            costPerInputToken: 0,
            costPerOutputToken: 0,
          },
        ];
      }
      throw error;
    }
  }

  async chat(
    request: ChatRequest,
    apiKey?: string
  ): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const modelId = this.parseModelId(request.model) || this.defaultModel;
    if (!modelId) {
      throw modelNotFoundError('No model specified and no default model set', 'vllm');
    }

    const isStreaming = request.options?.stream ?? false;

    const body = {
      model: modelId,
      messages: this.mapMessages(request.input),
      ...this.mapChatOptions(request.options || {}),
    };

    if (!isStreaming) {
      // Non-streaming request
      const response = await this.http.request<VLLMChatResponse>(
        `${this.baseUrl}/v1/chat/completions`,
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
        `${this.baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: this.getHeaders(apiKey),
          body: { ...body, stream: true },
        }
      );

      return this.streamChat(stream as ReadableStream<Uint8Array>, modelId);
    }
  }

  async embed(request: EmbedRequest, apiKey?: string): Promise<EmbedResponse> {
    const modelId = this.parseModelId(request.model) || this.defaultModel;
    if (!modelId) {
      throw modelNotFoundError('No model specified and no default model set', 'vllm');
    }

    const body = {
      model: modelId,
      input: request.input,
      encoding_format: request.options?.encodingFormat || 'float',
    };

    const response = await this.http.request<VLLMEmbeddingResponse>(
      `${this.baseUrl}/v1/embeddings`,
      {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body,
      }
    );

    return {
      providerId: 'vllm',
      modelId,
      embeddings: response.data.map((item) => item.embedding),
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  // Private helper methods

  private getHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.defaultApiKey;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    return headers;
  }

  private parseModelId(model: string): string | undefined {
    // Handle "provider:model" format
    if (model.includes(':')) {
      return model.split(':')[1];
    }
    return model || undefined;
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

    return mapped;
  }

  private mapChatResponse(response: VLLMChatResponse): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw parsingError('No choices in response', 'vllm');
    }

    return {
      model: `vllm:${response.model}`,
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
    for await (const event of parseSSEJSON<VLLMChatStreamChunk>(stream)) {
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
