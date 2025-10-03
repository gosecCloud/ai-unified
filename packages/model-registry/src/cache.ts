/**
 * In-memory LRU cache for models
 */

import type { ModelInfo } from '@aiu/core';

interface CacheEntry {
  models: ModelInfo[];
  timestamp: Date;
}

export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 30 minutes) */
  ttlMs?: number;
  /** Maximum number of provider caches to keep */
  maxSize?: number;
}

export class ModelCache {
  private cache = new Map<string, CacheEntry>();
  private ttlMs: number;
  private maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1000; // 30 minutes
    this.maxSize = options.maxSize ?? 100;
  }

  /**
   * Set models for a provider
   */
  set(providerId: string, models: ModelInfo[]): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(providerId)) {
      const oldest = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime()
      )[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }

    this.cache.set(providerId, {
      models,
      timestamp: new Date(),
    });
  }

  /**
   * Get models for a provider (if not expired)
   */
  get(providerId: string): ModelInfo[] | undefined {
    const entry = this.cache.get(providerId);
    if (!entry) return undefined;

    const age = Date.now() - entry.timestamp.getTime();
    if (age > this.ttlMs) {
      this.cache.delete(providerId);
      return undefined;
    }

    return entry.models;
  }

  /**
   * Check if provider models are cached and fresh
   */
  has(providerId: string): boolean {
    return this.get(providerId) !== undefined;
  }

  /**
   * Invalidate cache for a provider
   */
  invalidate(providerId: string): void {
    this.cache.delete(providerId);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all cached provider IDs
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}
