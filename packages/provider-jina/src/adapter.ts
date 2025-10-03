/**
 * Jina AI provider adapter
 *
 * Supports embeddings and reranking
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
} from '@aiu/core';
import { HttpClient } from '@aiu/transport';
import { validationError } from '@aiu/core';

const BASE_URL = 'https://api.jina.ai/v1';

// Static model catalog
const JINA_MODELS: ModelInfo[] = [
  {
    providerId: 'jina',
    modelId: 'jina-embeddings-v3',
    kind: 'embed',
    contextWindow: 8192,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.00000002, // $0.02 per 1M tokens
    costPerOutputToken: 0,
  },
  {
    providerId: 'jina',
    modelId: 'jina-embeddings-v2-base-en',
    kind: 'embed',
    contextWindow: 8192,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.00000002,
    costPerOutputToken: 0,
  },
  {
    providerId: 'jina',
    modelId: 'jina-reranker-v2-base-multilingual',
    kind: 'rerank',
    contextWindow: 8192,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.00000002,
    costPerOutputToken: 0,
  },
  {
    providerId: 'jina',
    modelId: 'jina-reranker-v1-base-en',
    kind: 'rerank',
    contextWindow: 8192,
    maxOutputTokens: 0,
    modalities: ['text'],
    deprecated: false,
    costPerInputToken: 0.00000002,
    costPerOutputToken: 0,
  },
];

interface JinaEmbedResponse {
  model: string;
  object: string;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
  };
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
}

interface JinaRerankResponse {
  model: string;
  usage: {
    total_tokens: number;
  };
  results: Array<{
    index: number;
    document: {
      text: string;
    };
    relevance_score: number;
  }>;
}

export interface JinaAdapterOptions {
  baseUrl?: string;
}

export class JinaAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;

  constructor(options: JinaAdapterOptions = {}) {
    this.http = new HttpClient({
      timeoutMs: 120000,
      maxRetries: 3,
    });
    this.baseUrl = options.baseUrl || BASE_URL;
  }

  info(): ProviderInfo {
    return {
      id: 'jina',
      name: 'Jina AI',
      supports: ['embed', 'rerank'],
      endpoints: {
        embed: `${this.baseUrl}/embeddings`,
        rerank: `${this.baseUrl}/rerank`,
      },
    };
  }

  async validateApiKey(key: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Test with a simple embedding request
      await this.http.request(
        `${this.baseUrl}/embeddings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: {
            model: 'jina-embeddings-v3',
            input: ['test'],
          },
        },
        'jina'
      );
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Invalid API key',
      };
    }
  }

  async listModels(_key: string): Promise<ModelInfo[]> {
    return JINA_MODELS;
  }

  async chat(_req: ChatRequest, _key: string): Promise<ChatResponse> {
    throw validationError('Jina AI does not support chat completions');
  }

  async embed(req: EmbedRequest, key: string): Promise<EmbedResponse> {
    const modelId = req.model.includes(':') ? req.model.split(':')[1] : req.model;

    const body = {
      model: modelId,
      input: Array.isArray(req.input) ? req.input : [req.input],
      encoding_format: 'float',
    };

    const response = await this.http.request<JinaEmbedResponse>(
      `${this.baseUrl}/embeddings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body,
      },
      'jina'
    );

    return {
      providerId: 'jina',
      modelId: response.model,
      embeddings: response.data.map((d) => d.embedding),
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  async rerank(req: RerankRequest, key: string): Promise<RerankResponse> {
    const modelId = req.model.includes(':') ? req.model.split(':')[1] : req.model;

    // Normalize documents to strings
    const documents = req.documents.map((doc) => ({
      text: typeof doc === 'string' ? doc : doc.text,
    }));

    const body = {
      model: modelId,
      query: req.query,
      documents,
      top_n: req.options?.top_n,
      return_documents: req.options?.return_documents ?? true,
    };

    const response = await this.http.request<JinaRerankResponse>(
      `${this.baseUrl}/rerank`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body,
      },
      'jina'
    );

    return {
      providerId: 'jina',
      modelId: response.model,
      results: response.results.map((result) => ({
        index: result.index,
        relevance_score: result.relevance_score,
        document: result.document?.text || req.documents[result.index],
      })),
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }
}
