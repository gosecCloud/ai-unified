/**
 * Token bucket rate limiter
 */

export interface RateLimiterOptions {
  /** Maximum number of tokens in the bucket */
  capacity: number;
  /** Rate at which tokens are refilled (tokens per second) */
  refillRate: number;
  /** Initial number of tokens */
  initialTokens?: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(options: RateLimiterOptions) {
    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.tokens = options.initialTokens ?? options.capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens. Returns true if successful, false otherwise.
   */
  tryConsume(tokens = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Wait until enough tokens are available, then consume them
   */
  async consume(tokens = 1): Promise<void> {
    while (!this.tryConsume(tokens)) {
      const waitTime = this.timeUntilTokens(tokens);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Get the current number of available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Calculate time (ms) until the specified number of tokens will be available
   */
  timeUntilTokens(tokens: number): number {
    this.refill();

    if (this.tokens >= tokens) {
      return 0;
    }

    const tokensNeeded = tokens - this.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000);
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Reset the rate limiter to initial state
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
}

/**
 * Composite rate limiter that manages multiple limiters by key
 */
export class KeyedRateLimiter<K = string> {
  private limiters = new Map<K, RateLimiter>();
  private options: RateLimiterOptions;

  constructor(options: RateLimiterOptions) {
    this.options = options;
  }

  async consume(key: K, tokens = 1): Promise<void> {
    const limiter = this.getLimiter(key);
    await limiter.consume(tokens);
  }

  tryConsume(key: K, tokens = 1): boolean {
    const limiter = this.getLimiter(key);
    return limiter.tryConsume(tokens);
  }

  getAvailableTokens(key: K): number {
    const limiter = this.getLimiter(key);
    return limiter.getAvailableTokens();
  }

  reset(key: K): void {
    this.limiters.delete(key);
  }

  resetAll(): void {
    this.limiters.clear();
  }

  private getLimiter(key: K): RateLimiter {
    let limiter = this.limiters.get(key);
    if (!limiter) {
      limiter = new RateLimiter(this.options);
      this.limiters.set(key, limiter);
    }
    return limiter;
  }
}
