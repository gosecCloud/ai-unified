/**
 * Unified SDK orchestrator - Main entry point for AI Unified
 */

import type {
  ProviderAdapter,
  ChatRequest,
  ChatResponse,
  EmbedRequest,
  EmbedResponse,
  ImageRequest,
  ImageResponse,
  TranscribeRequest,
  TranscribeResponse,
  SpeechRequest,
  SpeechResponse,
  RerankRequest,
  RerankResponse,
  StreamChunk,
  ChatDelta,
  RequestLog,
  ModelInfo,
} from '@aiu/core';
import {
  parseModelString,
  generateRequestId,
  validationError,
  modelNotFoundError,
  calculateCost,
  AIUEventEmitter,
  type RequestStartEvent,
  type RequestSuccessEvent,
  type RequestErrorEvent,
} from '@aiu/core';
import { KeyedRateLimiter, type RateLimiterOptions } from '@aiu/transport';
import type { PersistentKeyring } from './persistent-keyring.js';
import type { ModelRegistry } from '@aiu/model-registry';
import type { RequestRepository } from '@aiu/storage';
import { createLogger, defaultMetrics, type Logger } from '@aiu/observability';

export interface AIUOptions {
  /** Persistent keyring for API key management */
  keyring: PersistentKeyring;
  /** Model registry for discovery */
  registry: ModelRegistry;
  /** Request repository for usage logging */
  requestRepository?: RequestRepository;
  /** Logger instance (optional, creates default if not provided) */
  logger?: Logger;
  /** Rate limiter options per provider */
  rateLimiter?: RateLimiterOptions;
  /** Max concurrent requests per provider */
  maxConcurrency?: number;
  /** Default key alias to use */
  defaultKeyAlias?: string;
}

export interface ChatOptions {
  /** Key alias to use (defaults to 'default') */
  keyAlias?: string;
  /** Request metadata */
  metadata?: Record<string, string>;
}

/**
 * Main SDK orchestrator class
 */
export class AIU {
  private keyring: PersistentKeyring;
  private registry: ModelRegistry;
  private requestRepo?: RequestRepository;
  private logger: Logger;
  private rateLimiter: KeyedRateLimiter<string>;
  private concurrencyGates = new Map<string, number>();
  private maxConcurrency: number;
  private defaultKeyAlias: string;
  private events: AIUEventEmitter;

  constructor(options: AIUOptions) {
    this.keyring = options.keyring;
    this.registry = options.registry;
    this.requestRepo = options.requestRepository;
    this.logger = options.logger ?? createLogger({ level: 'info' });
    this.maxConcurrency = options.maxConcurrency ?? 10;
    this.defaultKeyAlias = options.defaultKeyAlias ?? 'default';
    this.events = new AIUEventEmitter();

    // Initialize rate limiter with defaults
    this.rateLimiter = new KeyedRateLimiter(
      options.rateLimiter ?? {
        capacity: 100,
        refillRate: 10,
      }
    );
  }

  /**
   * Make a chat completion request
   */
  async chat(req: ChatRequest, opts?: ChatOptions): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Parse model string
    const { providerId, modelId } = parseModelString(req.model);
    if (!providerId) {
      throw validationError('Model must be in format "provider:model"');
    }

    // Get provider adapter
    const adapter = this.getAdapter(providerId);

    // Get API key
    const keyAlias = opts?.keyAlias ?? this.defaultKeyAlias;
    const apiKey = this.keyring.get(providerId, keyAlias);

    // Resolve model info for cost calculation
    const modelInfo = await this.registry.findOne(providerId, modelId);

    // Apply rate limiting
    await this.rateLimiter.consume(providerId);

    // Apply concurrency gate
    await this.acquireConcurrencySlot(providerId);

    try {
      // Emit start event
      await this.events.emit<RequestStartEvent>(
        'request:start',
        {
          request: req,
          providerId,
          modelId,
        },
        { requestId, providerId }
      );

      this.logger.info({ requestId, providerId, modelId, stream: req.options?.stream }, 'Starting chat request');

      // Make request
      const response = await adapter.chat(req, apiKey);

      // Handle streaming
      if (this.isAsyncIterable(response)) {
        return this.wrapStreamWithTracking(response, {
          requestId,
          providerId,
          modelId,
          startTime,
          modelInfo,
          metadata: opts?.metadata,
        });
      }

      // Handle non-streaming
      const latency = Date.now() - startTime;

      // Emit success event
      await this.events.emit<RequestSuccessEvent>(
        'request:success',
        {
          request: req,
          response,
          latencyMs: latency,
        },
        { requestId, providerId }
      );

      this.logger.info(
        {
          requestId,
          providerId,
          modelId,
          latency,
          tokens: response.usage?.totalTokens,
        },
        'Chat request completed'
      );

      // Record metrics
      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'success' });
      defaultMetrics.histogram('ai.request.latency', latency, { provider: providerId });

      // Log request to database
      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        tokensIn: response.usage?.promptTokens,
        tokensOut: response.usage?.completionTokens,
        cost: this.calculateRequestCost(response.usage?.promptTokens, response.usage?.completionTokens, modelInfo),
        status: 'success',
        metadata: opts?.metadata,
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      // Emit error event
      await this.events.emit<RequestErrorEvent>(
        'request:error',
        {
          request: req,
          error: error as Error,
          latencyMs: latency,
        },
        { requestId, providerId }
      );

      this.logger.error({ requestId, providerId, modelId, latency, error }, 'Chat request failed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'error' });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: opts?.metadata,
      });

      throw error;
    } finally {
      this.releaseConcurrencySlot(providerId);
    }
  }

  /**
   * Generate embeddings
   */
  async embed(req: EmbedRequest, opts?: ChatOptions): Promise<EmbedResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const { providerId, modelId } = parseModelString(req.model);
    if (!providerId) {
      throw validationError('Model must be in format "provider:model"');
    }

    const adapter = this.getAdapter(providerId);
    if (!adapter.embed) {
      throw validationError(`Provider ${providerId} does not support embeddings`);
    }

    const keyAlias = opts?.keyAlias ?? this.defaultKeyAlias;
    const apiKey = this.keyring.get(providerId, keyAlias);

    await this.rateLimiter.consume(providerId);
    await this.acquireConcurrencySlot(providerId);

    try {
      this.logger.info({ requestId, providerId, modelId }, 'Starting embed request');

      const response = await adapter.embed(req, apiKey);
      const latency = Date.now() - startTime;

      this.logger.info({ requestId, providerId, modelId, latency, embeddings: response.embeddings.length }, 'Embed request completed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'success' });
      defaultMetrics.histogram('ai.request.latency', latency, { provider: providerId });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        tokensIn: response.usage?.totalTokens,
        status: 'success',
        metadata: opts?.metadata,
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error({ requestId, providerId, modelId, latency, error }, 'Embed request failed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'error' });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: opts?.metadata,
      });

      throw error;
    } finally {
      this.releaseConcurrencySlot(providerId);
    }
  }

  /**
   * Generate images
   */
  async image(req: ImageRequest, opts?: ChatOptions): Promise<ImageResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const { providerId, modelId } = parseModelString(req.model);
    if (!providerId) {
      throw validationError('Model must be in format "provider:model"');
    }

    const adapter = this.getAdapter(providerId);
    if (!adapter.image) {
      throw validationError(`Provider ${providerId} does not support image generation`);
    }

    const keyAlias = opts?.keyAlias ?? this.defaultKeyAlias;
    const apiKey = this.keyring.get(providerId, keyAlias);

    await this.rateLimiter.consume(providerId);
    await this.acquireConcurrencySlot(providerId);

    try {
      this.logger.info({ requestId, providerId, modelId }, 'Starting image generation request');

      const response = await adapter.image(req, apiKey);
      const latency = Date.now() - startTime;

      this.logger.info({ requestId, providerId, modelId, latency, images: response.images.length }, 'Image generation completed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'success' });
      defaultMetrics.histogram('ai.request.latency', latency, { provider: providerId });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        tokensIn: response.usage?.totalTokens,
        status: 'success',
        metadata: opts?.metadata,
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error({ requestId, providerId, modelId, latency, error }, 'Image generation failed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'error' });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: opts?.metadata,
      });

      throw error;
    } finally {
      this.releaseConcurrencySlot(providerId);
    }
  }

  /**
   * Transcribe audio (speech-to-text)
   */
  async transcribe(req: TranscribeRequest, opts?: ChatOptions): Promise<TranscribeResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const { providerId, modelId } = parseModelString(req.model);
    if (!providerId) {
      throw validationError('Model must be in format "provider:model"');
    }

    const adapter = this.getAdapter(providerId);
    if (!adapter.audio) {
      throw validationError(`Provider ${providerId} does not support audio transcription`);
    }

    const keyAlias = opts?.keyAlias ?? this.defaultKeyAlias;
    const apiKey = this.keyring.get(providerId, keyAlias);

    await this.rateLimiter.consume(providerId);
    await this.acquireConcurrencySlot(providerId);

    try {
      this.logger.info({ requestId, providerId, modelId }, 'Starting audio transcription request');

      const response = await adapter.audio(req, apiKey);
      const latency = Date.now() - startTime;

      this.logger.info({ requestId, providerId, modelId, latency }, 'Audio transcription completed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'success' });
      defaultMetrics.histogram('ai.request.latency', latency, { provider: providerId });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        tokensIn: response.usage?.totalTokens,
        status: 'success',
        metadata: opts?.metadata,
      });

      return response as TranscribeResponse;
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error({ requestId, providerId, modelId, latency, error }, 'Audio transcription failed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'error' });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: opts?.metadata,
      });

      throw error;
    } finally {
      this.releaseConcurrencySlot(providerId);
    }
  }

  /**
   * Convert text to speech
   */
  async speak(req: SpeechRequest, opts?: ChatOptions): Promise<SpeechResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const { providerId, modelId } = parseModelString(req.model);
    if (!providerId) {
      throw validationError('Model must be in format "provider:model"');
    }

    const adapter = this.getAdapter(providerId);
    if (!adapter.audio) {
      throw validationError(`Provider ${providerId} does not support text-to-speech`);
    }

    const keyAlias = opts?.keyAlias ?? this.defaultKeyAlias;
    const apiKey = this.keyring.get(providerId, keyAlias);

    await this.rateLimiter.consume(providerId);
    await this.acquireConcurrencySlot(providerId);

    try {
      this.logger.info({ requestId, providerId, modelId }, 'Starting text-to-speech request');

      const response = await adapter.audio(req, apiKey);
      const latency = Date.now() - startTime;

      this.logger.info({ requestId, providerId, modelId, latency }, 'Text-to-speech completed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'success' });
      defaultMetrics.histogram('ai.request.latency', latency, { provider: providerId });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        tokensIn: response.usage?.totalTokens,
        status: 'success',
        metadata: opts?.metadata,
      });

      return response as SpeechResponse;
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error({ requestId, providerId, modelId, latency, error }, 'Text-to-speech failed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'error' });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: opts?.metadata,
      });

      throw error;
    } finally {
      this.releaseConcurrencySlot(providerId);
    }
  }

  /**
   * Rerank documents by relevance
   */
  async rerank(req: RerankRequest, opts?: ChatOptions): Promise<RerankResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const { providerId, modelId } = parseModelString(req.model);
    if (!providerId) {
      throw validationError('Model must be in format "provider:model"');
    }

    const adapter = this.getAdapter(providerId);
    if (!adapter.rerank) {
      throw validationError(`Provider ${providerId} does not support reranking`);
    }

    const keyAlias = opts?.keyAlias ?? this.defaultKeyAlias;
    const apiKey = this.keyring.get(providerId, keyAlias);

    await this.rateLimiter.consume(providerId);
    await this.acquireConcurrencySlot(providerId);

    try {
      this.logger.info({ requestId, providerId, modelId, documents: req.documents.length }, 'Starting rerank request');

      const response = await adapter.rerank(req, apiKey);
      const latency = Date.now() - startTime;

      this.logger.info({ requestId, providerId, modelId, latency, results: response.results.length }, 'Rerank completed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'success' });
      defaultMetrics.histogram('ai.request.latency', latency, { provider: providerId });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        tokensIn: response.usage?.totalTokens,
        status: 'success',
        metadata: opts?.metadata,
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error({ requestId, providerId, modelId, latency, error }, 'Rerank failed');

      defaultMetrics.increment('ai.requests.total', 1, { provider: providerId, model: modelId, status: 'error' });

      await this.logRequest({
        requestId,
        providerId,
        modelId,
        latencyMs: latency,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: opts?.metadata,
      });

      throw error;
    } finally {
      this.releaseConcurrencySlot(providerId);
    }
  }

  /**
   * Subscribe to events
   */
  on(event: any, handler: (...args: any[]) => void) {
    return this.events.on(event, handler);
  }

  /**
   * Get registered providers
   */
  getProviders(): string[] {
    return this.registry.getProviders();
  }

  /**
   * Find models
   */
  async findModels(query?: Parameters<ModelRegistry['find']>[0]): Promise<ModelInfo[]> {
    return this.registry.find(query);
  }

  /**
   * Refresh models for a provider
   */
  async refreshModels(providerId: string, keyAlias?: string): Promise<ModelInfo[]> {
    const alias = keyAlias ?? this.defaultKeyAlias;
    const apiKey = this.keyring.get(providerId, alias);
    return this.registry.refresh(providerId, apiKey);
  }

  private getAdapter(providerId: string): ProviderAdapter {
    const adapter = this.registry.getAdapter(providerId);
    if (!adapter) {
      throw modelNotFoundError(providerId, 'Provider not registered');
    }
    return adapter;
  }

  private async acquireConcurrencySlot(providerId: string): Promise<void> {
    while ((this.concurrencyGates.get(providerId) ?? 0) >= this.maxConcurrency) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.concurrencyGates.set(providerId, (this.concurrencyGates.get(providerId) ?? 0) + 1);
  }

  private releaseConcurrencySlot(providerId: string): void {
    const current = this.concurrencyGates.get(providerId) ?? 0;
    this.concurrencyGates.set(providerId, Math.max(0, current - 1));
  }

  private async *wrapStreamWithTracking(
    stream: AsyncIterable<StreamChunk<ChatDelta>>,
    context: {
      requestId: string;
      providerId: string;
      modelId: string;
      startTime: number;
      modelInfo?: ModelInfo;
      metadata?: Record<string, string>;
    }
  ): AsyncIterable<StreamChunk<ChatDelta>> {
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    try {
      for await (const chunk of stream) {
        yield chunk;
      }

      const latency = Date.now() - context.startTime;

      this.logger.info(
        {
          requestId: context.requestId,
          providerId: context.providerId,
          modelId: context.modelId,
          latency,
        },
        'Streaming chat completed'
      );

      defaultMetrics.increment('ai.requests.total', 1, {
        provider: context.providerId,
        model: context.modelId,
        status: 'success',
      });
      defaultMetrics.histogram('ai.request.latency', latency, { provider: context.providerId });

      await this.logRequest({
        requestId: context.requestId,
        providerId: context.providerId,
        modelId: context.modelId,
        latencyMs: latency,
        tokensIn: totalTokensIn || undefined,
        tokensOut: totalTokensOut || undefined,
        cost: this.calculateRequestCost(totalTokensIn, totalTokensOut, context.modelInfo),
        status: 'success',
        metadata: context.metadata,
      });
    } catch (error) {
      const latency = Date.now() - context.startTime;

      this.logger.error(
        {
          requestId: context.requestId,
          providerId: context.providerId,
          modelId: context.modelId,
          latency,
          error,
        },
        'Streaming chat failed'
      );

      defaultMetrics.increment('ai.requests.total', 1, {
        provider: context.providerId,
        model: context.modelId,
        status: 'error',
      });

      await this.logRequest({
        requestId: context.requestId,
        providerId: context.providerId,
        modelId: context.modelId,
        latencyMs: latency,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: context.metadata,
      });

      throw error;
    }
  }

  private calculateRequestCost(tokensIn?: number, tokensOut?: number, modelInfo?: ModelInfo): number | undefined {
    if (!tokensIn || !tokensOut || !modelInfo?.costPerInputToken || !modelInfo?.costPerOutputToken) {
      return undefined;
    }
    return calculateCost(tokensIn, tokensOut, modelInfo.costPerInputToken, modelInfo.costPerOutputToken);
  }

  private async logRequest(
    log: Omit<RequestLog, 'id' | 'timestamp'> & { requestId: string; metadata?: Record<string, string> }
  ): Promise<void> {
    if (!this.requestRepo) return;

    try {
      await this.requestRepo.save({
        timestamp: new Date(),
        providerId: log.providerId,
        modelId: log.modelId,
        latencyMs: log.latencyMs,
        tokensIn: log.tokensIn,
        tokensOut: log.tokensOut,
        cost: log.cost,
        status: log.status as RequestLog['status'],
        errorMessage: log.errorMessage,
        metadata: log.metadata,
      });
    } catch (error) {
      this.logger.error({ requestId: log.requestId, error }, 'Failed to log request to database');
    }
  }

  private isAsyncIterable(value: unknown): value is AsyncIterable<StreamChunk<ChatDelta>> {
    return value != null && typeof value === 'object' && Symbol.asyncIterator in value;
  }
}
