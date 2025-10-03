/**
 * Cohere provider adapter
 *
 * Cohere has a custom API structure (not OpenAI-compatible)
 * Supports Command models with RAG, reranking, and vision
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  EmbedRequest,
  EmbedResponse,
  RerankRequest,
  RerankResponse,
  StreamChunk,
  ChatDelta,
  Message,
} from '@aiu/core';
import { HttpClient } from '@aiu/transport';

const BASE_URL = 'https://api.cohere.ai/v1';

interface CohereChatResponse {
  text: string;
  generation_id?: string;
  citations?: any[];
  documents?: any[];
  is_search_required?: boolean;
  search_queries?: any[];
  search_results?: any[];
  finish_reason?: string;
  tool_calls?: Array<{
    name: string;
    parameters: Record<string, any>;
  }>;
  chat_history?: any[];
  meta?: {
    api_version?: {
      version: string;
    };
    billed_units?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
}

interface CohereStreamEvent {
  event_type: string;
  text?: string;
  finish_reason?: string;
  is_finished?: boolean;
}

interface CohereEmbedResponse {
  id: string;
  texts: string[];
  embeddings: number[][];
  meta: {
    api_version: {
      version: string;
    };
    billed_units?: {
      input_tokens?: number;
    };
  };
}

// Static model catalog (2025)
const COHERE_MODELS: ModelInfo[] = [
  {
    providerId: 'cohere',
    modelId: 'command-a-03-2025',
    kind: 'chat',
    contextWindow: 256000,
    maxOutputTokens: 8192,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.000003,  // $3 per 1M tokens (estimated)
    costPerOutputToken: 0.000015, // $15 per 1M tokens (estimated)
  },
  {
    providerId: 'cohere',
    modelId: 'command-a-vision-07-2025',
    kind: 'chat',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    modalities: ['text', 'image'],
    deprecated: false,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
  },
  {
    providerId: 'cohere',
    modelId: 'command-r-plus-08-2024',
    kind: 'chat',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.000002,  // $2 per 1M tokens
    costPerOutputToken: 0.00001,  // $10 per 1M tokens
  },
  {
    providerId: 'cohere',
    modelId: 'command-r-08-2024',
    kind: 'chat',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.00000015, // $0.15 per 1M tokens
    costPerOutputToken: 0.0000006,  // $0.60 per 1M tokens
  },
  {
    providerId: 'cohere',
    modelId: 'command-r7b-12-2024',
    kind: 'chat',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.00000005, // $0.05 per 1M tokens
    costPerOutputToken: 0.00000015, // $0.15 per 1M tokens
  },
  {
    providerId: 'cohere',
    modelId: 'embed-english-v3.0',
    kind: 'embed',
    contextWindow: 512,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.0000001, // $0.1 per 1M tokens
    costPerOutputToken: 0,
  },
  {
    providerId: 'cohere',
    modelId: 'embed-multilingual-v3.0',
    kind: 'embed',
    contextWindow: 512,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.0000001,
    costPerOutputToken: 0,
  },
  {
    providerId: 'cohere',
    modelId: 'rerank-english-v3.0',
    kind: 'rerank',
    contextWindow: 4096,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.000001, // $1 per 1M tokens (estimated)
    costPerOutputToken: 0,
  },
  {
    providerId: 'cohere',
    modelId: 'rerank-multilingual-v3.0',
    kind: 'rerank',
    contextWindow: 4096,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.000001,
    costPerOutputToken: 0,
  },
];

export class CohereAdapter implements ProviderAdapter {
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
      id: 'cohere',
      name: 'Cohere',
      supports: ['chat', 'embed', 'rerank'],
      endpoints: {
        chat: `${this.baseUrl}/chat`,
        embed: `${this.baseUrl}/embed`,
        rerank: `${this.baseUrl}/rerank`,
      },
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000,
      },
    };
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Simple validation by attempting a minimal chat request
      await this.http.request<CohereChatResponse>(
        `${this.baseUrl}/chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: {
            model: 'command-r7b-12-2024',
            message: 'test',
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
    // Cohere doesn't have a public models endpoint, return static catalog
    return COHERE_MODELS;
  }

  async chat(
    request: ChatRequest,
    apiKey: string
  ): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const modelId = this.parseModelId(request.model);
    const isStreaming = request.options?.stream ?? false;

    // Convert messages to Cohere format
    const { message, chatHistory, preamble } = this.mapMessagesToCohere(request.input);

    const body: any = {
      model: modelId,
      message,
      ...(chatHistory.length > 0 && { chat_history: chatHistory }),
      ...(preamble && { preamble }),
      ...this.mapChatOptions(request.options || {}),
    };

    if (!isStreaming) {
      // Non-streaming request
      const response = await this.http.request<CohereChatResponse>(
        `${this.baseUrl}/chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      return this.mapChatResponse(response, modelId);
    } else {
      // Streaming request
      const stream = await this.http.stream(
        `${this.baseUrl}/chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
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
      texts: Array.isArray(request.input) ? request.input : [request.input],
      input_type: request.options?.inputType || 'search_document',
      embedding_types: request.options?.embeddingTypes || ['float'],
    };

    const response = await this.http.request<CohereEmbedResponse>(
      `${this.baseUrl}/embed`,
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
      providerId: 'cohere',
      modelId,
      embeddings: response.embeddings,
      usage: {
        totalTokens: response.meta.billed_units?.input_tokens || 0,
      },
    };
  }

  async rerank(request: RerankRequest, apiKey: string): Promise<RerankResponse> {
    const modelId = this.parseModelId(request.model);

    // Normalize documents to strings
    const documents = request.documents.map((doc) =>
      typeof doc === 'string' ? doc : doc.text
    );

    const body = {
      model: modelId,
      query: request.query,
      documents,
      top_n: request.options?.top_n,
      return_documents: request.options?.return_documents ?? false,
    };

    interface CohereRerankResponse {
      id: string;
      results: Array<{
        index: number;
        relevance_score: number;
        document?: {
          text: string;
        };
      }>;
      meta?: {
        api_version?: {
          version: string;
        };
        billed_units?: {
          search_units?: number;
        };
      };
    }

    const response = await this.http.request<CohereRerankResponse>(
      `${this.baseUrl}/rerank`,
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
      providerId: 'cohere',
      modelId,
      results: response.results.map((result) => ({
        index: result.index,
        relevance_score: result.relevance_score,
        document: result.document ? result.document.text : request.documents[result.index],
      })),
      usage: {
        totalTokens: response.meta?.billed_units?.search_units || 0,
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

  private mapMessagesToCohere(messages: Message[]): {
    message: string;
    chatHistory: any[];
    preamble?: string;
  } {
    let preamble: string | undefined;
    const chatHistory: any[] = [];
    let message = '';

    // Extract system message as preamble
    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) {
      preamble = typeof systemMsg.content === 'string' ? systemMsg.content : JSON.stringify(systemMsg.content);
    }

    // Convert conversation history
    const conversationMsgs = messages.filter((m) => m.role !== 'system');

    if (conversationMsgs.length === 0) {
      return { message: '', chatHistory: [], preamble };
    }

    // Last message is the current user message
    const lastMsg = conversationMsgs[conversationMsgs.length - 1]!;
    message = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);

    // Previous messages become chat history
    for (let i = 0; i < conversationMsgs.length - 1; i++) {
      const msg = conversationMsgs[i]!;
      chatHistory.push({
        role: msg.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    }

    return { message, chatHistory, preamble };
  }

  private mapChatOptions(options: Record<string, any>): Record<string, any> {
    const mapped: Record<string, any> = {};

    if (options.temperature !== undefined) mapped.temperature = options.temperature;
    if (options.max_tokens !== undefined) mapped.max_tokens = options.max_tokens;
    if (options.top_p !== undefined) mapped.p = options.top_p;
    if (options.top_k !== undefined) mapped.k = options.top_k;
    if (options.stop_sequences !== undefined) mapped.stop_sequences = options.stop_sequences;
    if (options.tools !== undefined) mapped.tools = options.tools;
    if (options.documents !== undefined) mapped.documents = options.documents;
    if (options.search_queries_only !== undefined) mapped.search_queries_only = options.search_queries_only;

    return mapped;
  }

  private mapChatResponse(response: CohereChatResponse, modelId: string): ChatResponse {
    return {
      model: `cohere:${modelId}`,
      id: response.generation_id || `cohere-${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      output: {
        role: 'assistant',
        content: response.text,
        tool_calls: response.tool_calls?.map((tc, index) => ({
          id: `call_${index}`,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.parameters),
          },
        })),
      },
      usage: response.meta?.billed_units
        ? {
            promptTokens: response.meta.billed_units.input_tokens || 0,
            completionTokens: response.meta.billed_units.output_tokens || 0,
            totalTokens:
              (response.meta.billed_units.input_tokens || 0) +
              (response.meta.billed_units.output_tokens || 0),
          }
        : undefined,
      finishReason: (response.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | undefined) || 'stop',
    };
  }

  private async *streamChat(
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
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.substring(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event: CohereStreamEvent = JSON.parse(data);

            if (event.event_type === 'text-generation' && event.text) {
              yield {
                delta: {
                  content: event.text,
                },
              };
            } else if (event.event_type === 'stream-end' && event.finish_reason) {
              yield {
                delta: {},
              };
            }
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
}
