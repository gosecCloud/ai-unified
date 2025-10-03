/**
 * Azure OpenAI provider adapter
 *
 * Supports Azure-managed OpenAI deployments with enterprise features
 * Requires resource name, deployment name, and API version
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

interface AzureChatResponse {
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

interface AzureChatStreamChunk {
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

interface AzureEmbeddingResponse {
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

export interface AzureOpenAIAdapterOptions {
  /**
   * Azure resource name (e.g., "my-resource")
   */
  resourceName: string;

  /**
   * Azure deployment name (e.g., "gpt-4-deployment")
   */
  deploymentName: string;

  /**
   * API version (e.g., "2024-02-15-preview")
   * @default "2024-02-15-preview"
   */
  apiVersion?: string;

  /**
   * Azure region (optional, for logging/debugging)
   */
  region?: string;
}

export class AzureOpenAIAdapter implements ProviderAdapter {
  private http: HttpClient;
  private resourceName: string;
  private deploymentName: string;
  private apiVersion: string;
  private baseUrl: string;

  constructor(options: AzureOpenAIAdapterOptions) {
    this.http = new HttpClient({
      timeoutMs: 120000,
      maxRetries: 3,
      retryBaseMs: 1000,
    });

    this.resourceName = options.resourceName;
    this.deploymentName = options.deploymentName;
    this.apiVersion = options.apiVersion || '2024-02-15-preview';

    // Azure OpenAI endpoint format
    this.baseUrl = `https://${this.resourceName}.openai.azure.com/openai/deployments/${this.deploymentName}`;
  }

  info(): ProviderInfo {
    return {
      id: 'azure',
      name: 'Azure OpenAI',
      supports: ['chat', 'embed'],
      endpoints: {
        chat: `${this.baseUrl}/chat/completions?api-version=${this.apiVersion}`,
        embed: `${this.baseUrl}/embeddings?api-version=${this.apiVersion}`,
      },
      rateLimit: {
        requestsPerMinute: 60, // Varies by Azure tier
        tokensPerMinute: 100000,
      },
    };
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Attempt a minimal chat request to validate
      await this.http.request<AzureChatResponse>(
        `${this.baseUrl}/chat/completions?api-version=${this.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: {
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1,
          },
        }
      );
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Invalid API key',
      };
    }
  }

  async listModels(_apiKey: string): Promise<ModelInfo[]> {
    // Azure OpenAI doesn't have a models list endpoint
    // Return deployment info as a model
    return [
      {
        providerId: 'azure',
        modelId: this.deploymentName,
        kind: 'chat',
        contextWindow: this.estimateContextWindow(this.deploymentName),
        maxOutputTokens: 4096,
        modalities: ['text'],
        deprecated: false,
        // Azure pricing varies by region and tier
        costPerInputToken: 0.000003,  // Estimated
        costPerOutputToken: 0.000006,
      },
    ];
  }

  async chat(
    request: ChatRequest,
    apiKey: string
  ): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const modelId = this.deploymentName; // Azure uses deployment name
    const isStreaming = request.options?.stream ?? false;

    const body = {
      messages: this.mapMessages(request.input),
      ...this.mapChatOptions(request.options || {}),
    };

    const url = `${this.baseUrl}/chat/completions?api-version=${this.apiVersion}`;

    if (!isStreaming) {
      // Non-streaming request
      const response = await this.http.request<AzureChatResponse>(
        url,
        {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      return this.mapChatResponse(response);
    } else {
      // Streaming request
      const stream = await this.http.stream(
        url,
        {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: { ...body, stream: true },
        }
      );

      return this.streamChat(stream as ReadableStream<Uint8Array>, modelId);
    }
  }

  async embed(request: EmbedRequest, apiKey: string): Promise<EmbedResponse> {
    const modelId = this.deploymentName;

    const body = {
      input: request.input,
      encoding_format: request.options?.encodingFormat || 'float',
    };

    const response = await this.http.request<AzureEmbeddingResponse>(
      `${this.baseUrl}/embeddings?api-version=${this.apiVersion}`,
      {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body,
      }
    );

    return {
      providerId: 'azure',
      modelId,
      embeddings: response.data.map((item) => item.embedding),
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  // Private helper methods

  private estimateContextWindow(deploymentName: string): number {
    const name = deploymentName.toLowerCase();

    if (name.includes('gpt-4-32k') || name.includes('gpt-4-turbo')) return 128000;
    if (name.includes('gpt-4')) return 8192;
    if (name.includes('gpt-35-turbo-16k')) return 16384;
    if (name.includes('gpt-35-turbo')) return 4096;

    return 4096; // Default
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
    if (options.presence_penalty !== undefined) mapped.presence_penalty = options.presence_penalty;
    if (options.frequency_penalty !== undefined) mapped.frequency_penalty = options.frequency_penalty;
    if (options.tools !== undefined) mapped.tools = options.tools;
    if (options.tool_choice !== undefined) mapped.tool_choice = options.tool_choice;
    if (options.user !== undefined) mapped.user = options.user;

    return mapped;
  }

  private mapChatResponse(response: AzureChatResponse): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw parsingError('No choices in response', 'azure');
    }

    return {
      model: `azure:${this.deploymentName}`,
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
    for await (const event of parseSSEJSON<AzureChatStreamChunk>(stream)) {
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
