/**
 * Error codes and custom error classes
 */

export type AIUErrorCode =
  | 'BAD_API_KEY'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'PROVIDER_DOWN'
  | 'MODEL_NOT_FOUND'
  | 'UNSUPPORTED_FEATURE'
  | 'VALIDATION_FAILED'
  | 'INVALID_REQUEST'
  | 'NETWORK_ERROR'
  | 'PARSING_ERROR'
  | 'STORAGE_ERROR'
  | 'ENCRYPTION_ERROR'
  | 'UNKNOWN';

export interface AIUErrorOptions {
  code: AIUErrorCode;
  message: string;
  providerId?: string;
  details?: unknown;
  cause?: Error;
}

/**
 * Base error class for AI Unified
 */
export class AIUError extends Error {
  public readonly code: AIUErrorCode;
  public readonly providerId?: string;
  public readonly details?: unknown;
  public override readonly cause?: Error;

  constructor(options: AIUErrorOptions) {
    super(options.message);
    this.name = 'AIUError';
    this.code = options.code;
    this.providerId = options.providerId;
    this.details = options.details;
    this.cause = options.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIUError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      providerId: this.providerId,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Factory functions for common errors
 */

export function badApiKeyError(providerId: string, reason?: string): AIUError {
  return new AIUError({
    code: 'BAD_API_KEY',
    message: `Invalid API key for provider "${providerId}"${reason ? `: ${reason}` : ''}`,
    providerId,
    details: { reason },
  });
}

export function rateLimitError(providerId: string, retryAfter?: number): AIUError {
  return new AIUError({
    code: 'RATE_LIMIT',
    message: `Rate limit exceeded for provider "${providerId}"${retryAfter ? ` (retry after ${retryAfter}s)` : ''}`,
    providerId,
    details: { retryAfter },
  });
}

export function timeoutError(providerId: string, timeoutMs: number): AIUError {
  return new AIUError({
    code: 'TIMEOUT',
    message: `Request to provider "${providerId}" timed out after ${timeoutMs}ms`,
    providerId,
    details: { timeoutMs },
  });
}

export function providerDownError(providerId: string, statusCode?: number): AIUError {
  return new AIUError({
    code: 'PROVIDER_DOWN',
    message: `Provider "${providerId}" is unavailable${statusCode ? ` (status: ${statusCode})` : ''}`,
    providerId,
    details: { statusCode },
  });
}

export function modelNotFoundError(providerId: string, modelId: string): AIUError {
  return new AIUError({
    code: 'MODEL_NOT_FOUND',
    message: `Model "${modelId}" not found for provider "${providerId}"`,
    providerId,
    details: { modelId },
  });
}

export function unsupportedFeatureError(providerId: string, feature: string): AIUError {
  return new AIUError({
    code: 'UNSUPPORTED_FEATURE',
    message: `Feature "${feature}" is not supported by provider "${providerId}"`,
    providerId,
    details: { feature },
  });
}

export function validationError(message: string, details?: unknown): AIUError {
  return new AIUError({
    code: 'VALIDATION_FAILED',
    message: `Validation failed: ${message}`,
    details,
  });
}

export function networkError(providerId: string, cause: Error): AIUError {
  return new AIUError({
    code: 'NETWORK_ERROR',
    message: `Network error communicating with provider "${providerId}": ${cause.message}`,
    providerId,
    cause,
  });
}

export function parsingError(providerId: string, message: string, cause?: Error): AIUError {
  return new AIUError({
    code: 'PARSING_ERROR',
    message: `Failed to parse response from provider "${providerId}": ${message}`,
    providerId,
    cause,
  });
}

export function storageError(message: string, cause?: Error): AIUError {
  return new AIUError({
    code: 'STORAGE_ERROR',
    message: `Storage error: ${message}`,
    cause,
  });
}

export function encryptionError(message: string, cause?: Error): AIUError {
  return new AIUError({
    code: 'ENCRYPTION_ERROR',
    message: `Encryption error: ${message}`,
    cause,
  });
}
