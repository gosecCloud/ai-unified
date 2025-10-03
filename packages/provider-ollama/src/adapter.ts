/**
 * Ollama provider adapter
 *
 * Supports local model execution via Ollama
 * Provides both native (/api/chat) and OpenAI-compatible (/v1/chat/completions) endpoints
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
import { parsingError, providerDownError } from '@aiu/core';

const DEFAULT_BASE_URL = 'http://localhost:11434';

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    images?: string[];
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaChatStreamChunk {
  model: string;
  created_at: string;
  message: {
    role?: string;
    content?: string;
    images?: string[];
  };
  done: boolean;
}

interface OllamaEmbedResponse {
  embedding: number[];
}

export interface OllamaAdapterOptions {
  /**
   * Base URL for Ollama server (default: http://localhost:11434)
   */
  baseUrl?: string;

  /**
   * Use OpenAI-compatible endpoint (default: false)
   * If true, uses /v1/chat/completions instead of /api/chat
   */
  useOpenAIEndpoint?: boolean;
}

export class OllamaAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;
  private useOpenAIEndpoint: boolean;

  constructor(options: OllamaAdapterOptions = {}) {
    this.http = new HttpClient({
      timeoutMs: 180000, // 3 minutes (local models can be slow)
      maxRetries: 2,
      retryBaseMs: 1000,
    });
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.useOpenAIEndpoint = options.useOpenAIEndpoint || false;
  }

  info(): ProviderInfo {
    return {
      id: 'ollama',
      name: 'Ollama (Local)',
      supports: ['chat', 'embed'],
      endpoints: {
        chat: this.useOpenAIEndpoint
          ? `${this.baseUrl}/v1/chat/completions`
          : `${this.baseUrl}/api/chat`,
        embed: `${this.baseUrl}/api/embeddings`,
        models: `${this.baseUrl}/api/tags`,
      },
      rateLimit: {
        requestsPerMinute: 1000, // No real limit for local
        tokensPerMinute: 1000000,
      },
    };
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Ollama doesn't require API keys, just check if server is running
      await this.listModels(apiKey);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Ollama server not reachable',
      };
    }
  }

  async listModels(_apiKey?: string): Promise<ModelInfo[]> {
    try {
      const response = await this.http.request<{ models: OllamaModel[] }>(
        `${this.baseUrl}/api/tags`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.models.map((model) => this.mapOllamaModel(model));
    } catch (error: any) {
      throw providerDownError('ollama');
    }
  }

  async chat(
    request: ChatRequest,
    _apiKey?: string
  ): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const modelId = this.parseModelId(request.model);
    const isStreaming = request.options?.stream ?? false;

    if (this.useOpenAIEndpoint) {
      return this.chatOpenAICompat(modelId, request, isStreaming);
    } else {
      return this.chatNative(modelId, request, isStreaming);
    }
  }

  async embed(request: EmbedRequest, _apiKey?: string): Promise<EmbedResponse> {
    const modelId = this.parseModelId(request.model);
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    // Ollama embed API processes one input at a time
    const embeddings: number[][] = [];

    for (const input of inputs) {
      const response = await this.http.request<OllamaEmbedResponse>(
        `${this.baseUrl}/api/embeddings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            model: modelId,
            prompt: input,
          },
        }
      );

      embeddings.push(response.embedding);
    }

    return {
      providerId: 'ollama',
      modelId,
      embeddings,
      usage: {
        totalTokens: 0, // Ollama doesn't provide token counts
      },
    };
  }

  // Private helper methods

  private async chatNative(
    modelId: string,
    request: ChatRequest,
    isStreaming: boolean
  ): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const body = {
      model: modelId,
      messages: this.mapMessages(request.input),
      stream: isStreaming,
      ...this.mapChatOptions(request.options || {}),
    };

    if (!isStreaming) {
      const response = await this.http.request<OllamaChatResponse>(
        `${this.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      return this.mapNativeChatResponse(response);
    } else {
      const stream = await this.http.stream(
        `${this.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      return this.streamNativeChat(stream as ReadableStream<Uint8Array>, modelId);
    }
  }

  private async chatOpenAICompat(
    modelId: string,
    request: ChatRequest,
    isStreaming: boolean
  ): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const body = {
      model: modelId,
      messages: this.mapMessages(request.input),
      ...this.mapChatOptions(request.options || {}),
    };

    if (!isStreaming) {
      const response = await this.http.request<any>(
        `${this.baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      return this.mapOpenAIChatResponse(response);
    } else {
      const stream = await this.http.stream(
        `${this.baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: { ...body, stream: true },
        }
      );

      return this.streamOpenAIChat(stream as ReadableStream<Uint8Array>, modelId);
    }
  }

  private parseModelId(model: string): string {
    // Handle "provider:model" format
    if (model.includes(':')) {
      return model.split(':')[1]!;
    }
    return model;
  }

  private mapOllamaModel(model: OllamaModel): ModelInfo {
    // Determine model kind based on name
    let kind: 'chat' | 'embed' = 'chat';
    if (model.name.includes('embed')) {
      kind = 'embed';
    }

    return {
      providerId: 'ollama',
      modelId: model.name,
      kind,
      contextWindow: this.estimateContextWindow(model),
      maxOutputTokens: 4096, // Default estimate
      modalities: ['text'],
      deprecated: false,
      costPerInputToken: 0, // Local models are free
      costPerOutputToken: 0,
    };
  }

  private estimateContextWindow(model: OllamaModel): number {
    const name = model.name.toLowerCase();

    // Common context window sizes
    if (name.includes('llama3.2') || name.includes('llama-3.2')) return 128000;
    if (name.includes('llama3') || name.includes('llama-3')) return 8192;
    if (name.includes('mistral')) return 32000;
    if (name.includes('gemma2')) return 8192;
    if (name.includes('phi')) return 4096;
    if (name.includes('qwen')) return 32000;

    // Default
    return 4096;
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
    if (options.max_tokens !== undefined) mapped.num_predict = options.max_tokens;
    if (options.top_p !== undefined) mapped.top_p = options.top_p;
    if (options.top_k !== undefined) mapped.top_k = options.top_k;
    if (options.stop !== undefined) mapped.stop = options.stop;
    if (options.seed !== undefined) mapped.seed = options.seed;

    return mapped;
  }

  private mapNativeChatResponse(response: OllamaChatResponse): ChatResponse {
    return {
      model: `ollama:${response.model}`,
      id: `ollama-${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      output: {
        role: response.message.role as 'assistant',
        content: response.message.content,
      },
      usage: response.eval_count
        ? {
            promptTokens: response.prompt_eval_count || 0,
            completionTokens: response.eval_count || 0,
            totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
          }
        : undefined,
      finishReason: response.done ? 'stop' : undefined,
    };
  }

  private mapOpenAIChatResponse(response: any): ChatResponse {
    const choice = response.choices?.[0];
    if (!choice) {
      throw parsingError('No choices in response', 'ollama');
    }

    return {
      model: `ollama:${response.model}`,
      id: response.id || `ollama-${Date.now()}`,
      created: response.created || Math.floor(Date.now() / 1000),
      output: {
        role: choice.message.role as 'assistant',
        content: choice.message.content,
      },
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens || 0,
            completionTokens: response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0,
          }
        : undefined,
      finishReason: choice.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | undefined,
    };
  }

  private async *streamNativeChat(
    stream: ReadableStream<Uint8Array>,
    _modelId: string
  ): AsyncIterable<StreamChunk<ChatDelta>> {
    const decoder = new TextDecoder();
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event: OllamaChatStreamChunk = JSON.parse(line);

            yield {
              delta: {
                role: event.message.role as 'assistant' | undefined,
                content: event.message.content,
              },
            };
          } catch (e) {
            // Skip malformed JSON
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async *streamOpenAIChat(
    stream: ReadableStream<Uint8Array>,
    _modelId: string
  ): AsyncIterable<StreamChunk<ChatDelta>> {
    for await (const event of parseSSEJSON<any>(stream)) {
      if (!event.choices || event.choices.length === 0) continue;

      const choice = event.choices[0];
      const delta = choice.delta;

      yield {
        delta: {
          role: delta.role as 'assistant' | undefined,
          content: delta.content,
        },
      };
    }
  }
}
