/**
 * HTTP client with retries, timeouts, and error handling
 */

import { networkError, timeoutError, rateLimitError, providerDownError, badApiKeyError, type AIUError } from '@aiu/core';
import { calculateBackoff, sleep } from '@aiu/core';

export interface HttpClientOptions {
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseMs?: number;
  /** Maximum delay for exponential backoff (ms) */
  retryMaxMs?: number;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Response type override ('json' | 'text' | 'arrayBuffer' | 'blob') */
  responseType?: 'json' | 'text' | 'arrayBuffer' | 'blob';
  /** Set to true to skip JSON.stringify and send body as-is (for binary data) */
  isRawBody?: boolean;
}

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  error: Error;
  response?: Response;
}

export type RetryPolicy = (ctx: RetryContext) => boolean;

export class HttpClient {
  private fetchImpl: typeof fetch;
  private options: Required<Omit<HttpClientOptions, 'fetch'>>;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetch || fetch;
    this.options = {
      timeoutMs: options.timeoutMs ?? 120000, // 2 minutes
      maxRetries: options.maxRetries ?? 3,
      retryBaseMs: options.retryBaseMs ?? 1000,
      retryMaxMs: options.retryMaxMs ?? 30000,
    };
  }

  async request<T = unknown>(
    url: string,
    options: RequestOptions = {},
    providerId?: string
  ): Promise<T> {
    const response = await this.requestRaw(url, options, providerId);
    return this.parseResponse<T>(response, providerId, options.responseType);
  }

  async requestRaw(
    url: string,
    options: RequestOptions = {},
    providerId?: string
  ): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? this.options.timeoutMs;
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.options.maxRetries) {
      try {
        // Create timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Merge abort signals
        const signal = this.mergeAbortSignals(controller.signal, options.signal);

        const response = await this.fetchImpl(url, {
          method: options.method ?? 'GET',
          headers: this.buildHeaders(options.headers, options.isRawBody),
          body: options.isRawBody
            ? (options.body as any)
            : (options.body ? JSON.stringify(options.body) : undefined),
          signal,
        });

        clearTimeout(timeoutId);

        // Check for rate limiting
        if (response.status === 429) {
          const retryAfter = this.parseRetryAfter(response.headers);
          if (attempt < this.options.maxRetries) {
            await sleep(retryAfter ?? calculateBackoff(attempt, this.options.retryBaseMs, this.options.retryMaxMs));
            attempt++;
            continue;
          }
          throw rateLimitError(providerId ?? 'unknown', retryAfter);
        }

        // Check for server errors
        if (response.status >= 500) {
          if (attempt < this.options.maxRetries) {
            await sleep(calculateBackoff(attempt, this.options.retryBaseMs, this.options.retryMaxMs));
            attempt++;
            continue;
          }
          throw providerDownError(providerId ?? 'unknown', response.status);
        }

        // Check for auth errors (401/403) - don't retry, parse error
        if (response.status === 401 || response.status === 403) {
          throw await this.parseError(response, providerId);
        }

        // Success or other client errors (4xx) - don't retry
        if (!response.ok) {
          throw await this.parseError(response, providerId);
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        // Check if aborted
        if (error instanceof Error && error.name === 'AbortError') {
          if (options.signal?.aborted) {
            // User-initiated abort
            throw error;
          }
          // Timeout
          throw timeoutError(providerId ?? 'unknown', timeoutMs);
        }

        // Network error - retry
        if (attempt < this.options.maxRetries) {
          await sleep(calculateBackoff(attempt, this.options.retryBaseMs, this.options.retryMaxMs));
          attempt++;
          continue;
        }

        // Max retries reached
        throw networkError(providerId ?? 'unknown', lastError);
      }
    }

    // Should never reach here, but for type safety
    throw lastError ?? new Error('Request failed after retries');
  }

  async stream(
    url: string,
    options: RequestOptions = {},
    providerId?: string
  ): Promise<AsyncIterable<Uint8Array>> {
    const response = await this.requestRaw(url, options, providerId);

    if (!response.ok) {
      throw await this.parseError(response, providerId);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return this.streamBody(response.body);
  }

  private async *streamBody(body: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private buildHeaders(customHeaders?: Record<string, string>, isRawBody?: boolean): Record<string, string> {
    return {
      ...(isRawBody ? {} : { 'Content-Type': 'application/json' }),
      'User-Agent': 'aiu/0.1.0',
      ...customHeaders,
    };
  }

  private mergeAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const validSignals = signals.filter((s): s is AbortSignal => s !== undefined);
    if (validSignals.length === 0) {
      return new AbortController().signal;
    }
    if (validSignals.length === 1) {
      return validSignals[0]!;
    }

    // Create a new controller that aborts when any signal aborts
    const controller = new AbortController();
    for (const signal of validSignals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }

  private parseRetryAfter(headers: Headers): number | undefined {
    const retryAfter = headers.get('Retry-After');
    if (!retryAfter) return undefined;

    // Try parsing as seconds
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return undefined;
  }

  private async parseResponse<T>(response: Response, providerId?: string, responseType?: string): Promise<T> {
    if (!response.ok) {
      throw await this.parseError(response, providerId);
    }

    const type = responseType || this.detectContentType(response);

    switch (type) {
      case 'arrayBuffer':
        return response.arrayBuffer() as Promise<T>;
      case 'blob':
        return response.blob() as Promise<T>;
      case 'text':
        return response.text() as Promise<T>;
      case 'json':
      default:
        return response.json() as Promise<T>;
    }
  }

  private detectContentType(response: Response): string {
    const contentType = response.headers.get('Content-Type') || '';

    // Audio/binary content
    if (contentType.includes('audio/') || contentType.includes('application/octet-stream')) {
      return 'arrayBuffer';
    }

    // JSON content
    if (contentType.includes('application/json')) {
      return 'json';
    }

    // Default to text
    return 'text';
  }

  private async parseError(response: Response, providerId?: string): Promise<AIUError> {
    let errorMessage: string;
    try {
      const errorBody: any = await response.json();
      errorMessage = errorBody.error?.message ?? errorBody.message ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }

    if (response.status === 401 || response.status === 403) {
      return badApiKeyError(providerId ?? 'unknown', errorMessage);
    }

    if (response.status === 429) {
      return rateLimitError(providerId ?? 'unknown');
    }

    if (response.status >= 500) {
      return providerDownError(providerId ?? 'unknown', response.status);
    }

    return networkError(providerId ?? 'unknown', new Error(errorMessage));
  }
}
