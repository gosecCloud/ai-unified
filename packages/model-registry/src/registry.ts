/**
 * Model registry with live discovery and caching
 */

import type { ModelInfo, ProviderAdapter } from '@aiu/core';
import type { ModelRepository } from '@aiu/storage';
import { ModelCache, type CacheOptions } from './cache.js';
import { validationError } from '@aiu/core';
import { createLogger, type Logger } from '@aiu/observability';

export interface ModelRegistryOptions {
  /** Model storage repository */
  repository?: ModelRepository;
  /** Cache options */
  cache?: CacheOptions;
  /** Logger instance */
  logger?: Logger;
}

export interface ModelQuery {
  /** Filter by provider ID */
  providerId?: string;
  /** Filter by model kind */
  kind?: string;
  /** Minimum context window */
  minContext?: number;
  /** Exclude deprecated models */
  excludeDeprecated?: boolean;
}

export class ModelRegistry {
  private providers = new Map<string, ProviderAdapter>();
  private cache: ModelCache;
  private repository?: ModelRepository;
  private logger: Logger;

  constructor(options: ModelRegistryOptions = {}) {
    this.repository = options.repository;
    this.cache = new ModelCache(options.cache);
    this.logger = options.logger ?? createLogger({ level: 'info' });
  }

  /**
   * Register a provider adapter
   */
  registerProvider(adapter: ProviderAdapter): void {
    const info = adapter.info();
    this.providers.set(info.id, adapter);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.cache.invalidate(providerId);
  }

  /**
   * Refresh models for a provider (fetch from API)
   */
  async refresh(providerId: string, apiKey: string): Promise<ModelInfo[]> {
    const adapter = this.providers.get(providerId);
    if (!adapter) {
      throw validationError(`Provider not registered: ${providerId}`);
    }

    // Fetch models from provider
    const models = await adapter.listModels(apiKey);

    // Update cache
    this.cache.set(providerId, models);

    // Persist to database if repository available
    if (this.repository) {
      await this.repository.saveMany(models);
    }

    return models;
  }

  /**
   * Refresh all registered providers
   */
  async refreshAll(keyResolver: (providerId: string) => Promise<string | undefined>): Promise<void> {
    const refreshPromises = Array.from(this.providers.keys()).map(async (providerId) => {
      const key = await keyResolver(providerId);
      if (key) {
        try {
          await this.refresh(providerId, key);
        } catch (error) {
          // Continue on error for individual providers
          this.logger.error({ error, providerId }, `Failed to refresh models for ${providerId}`);
        }
      }
    });

    await Promise.all(refreshPromises);
  }

  /**
   * Get all models (from cache, DB, or default)
   */
  async all(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];

    for (const providerId of this.providers.keys()) {
      // Try cache first
      let models = this.cache.get(providerId);

      // Try DB if not in cache
      if (!models && this.repository) {
        models = await this.repository.list(providerId);
        if (models.length > 0) {
          this.cache.set(providerId, models);
        }
      }

      if (models) {
        allModels.push(...models);
      }
    }

    return allModels;
  }

  /**
   * Find models matching query
   */
  async find(query: ModelQuery = {}): Promise<ModelInfo[]> {
    let models = await this.all();

    // Apply filters
    if (query.providerId) {
      models = models.filter((m) => m.providerId === query.providerId);
    }

    if (query.kind) {
      models = models.filter((m) => m.kind === query.kind);
    }

    if (query.minContext) {
      models = models.filter((m) => m.contextWindow && m.contextWindow >= query.minContext!);
    }

    if (query.excludeDeprecated) {
      models = models.filter((m) => !m.deprecated);
    }

    return models;
  }

  /**
   * Find a specific model
   */
  async findOne(providerId: string, modelId: string): Promise<ModelInfo | undefined> {
    // Try cache first
    const cached = this.cache.get(providerId);
    if (cached) {
      return cached.find((m) => m.modelId === modelId);
    }

    // Try DB
    if (this.repository) {
      const model = await this.repository.findByProviderAndModel(providerId, modelId);
      return model ?? undefined;
    }

    return undefined;
  }

  /**
   * Invalidate cache for a provider
   */
  invalidateCache(providerId: string): void {
    this.cache.invalidate(providerId);
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.cache.clear();
  }

  /**
   * Get list of registered providers
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider adapter by ID
   */
  getAdapter(providerId: string): ProviderAdapter | undefined {
    return this.providers.get(providerId);
  }
}
