/**
 * Event system for observability and hooks
 */

import type { AIRequest, AIResponse } from './types.js';

export type AIUEventType =
  | 'request:start'
  | 'request:success'
  | 'request:error'
  | 'request:retry'
  | 'stream:start'
  | 'stream:chunk'
  | 'stream:end'
  | 'stream:error'
  | 'provider:validated'
  | 'model:discovered'
  | 'key:added'
  | 'key:rotated';

export interface AIUEvent<T = unknown> {
  type: AIUEventType;
  timestamp: Date;
  requestId?: string;
  providerId?: string;
  data: T;
}

export interface RequestStartEvent {
  request: AIRequest;
  providerId: string;
  modelId: string;
}

export interface RequestSuccessEvent {
  request: AIRequest;
  response: AIResponse;
  latencyMs: number;
}

export interface RequestErrorEvent {
  request: AIRequest;
  error: Error;
  latencyMs: number;
}

export interface RequestRetryEvent {
  request: AIRequest;
  attempt: number;
  maxAttempts: number;
  delayMs: number;
}

export interface StreamChunkEvent {
  chunk: unknown;
  index: number;
}

export type EventHandler<T = unknown> = (event: AIUEvent<T>) => void | Promise<void>;

/**
 * Simple event emitter for AI Unified events
 */
export class AIUEventEmitter {
  private handlers = new Map<AIUEventType, Set<EventHandler>>();

  on<T = unknown>(type: AIUEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler);
    };
  }

  off(type: AIUEventType, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  async emit<T = unknown>(type: AIUEventType, data: T, meta?: { requestId?: string; providerId?: string }): Promise<void> {
    const event: AIUEvent<T> = {
      type,
      timestamp: new Date(),
      requestId: meta?.requestId,
      providerId: meta?.providerId,
      data,
    };

    const handlers = this.handlers.get(type);
    if (!handlers || handlers.size === 0) return;

    // Execute handlers in parallel
    await Promise.allSettled(
      Array.from(handlers).map((handler) => handler(event))
    );
  }

  removeAllListeners(type?: AIUEventType): void {
    if (type) {
      this.handlers.delete(type);
    } else {
      this.handlers.clear();
    }
  }
}
