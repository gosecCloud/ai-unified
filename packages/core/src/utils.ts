/**
 * Utility functions
 */

/**
 * Parse a model string in format "provider:model" or just "model"
 */
export function parseModelString(modelString: string): { providerId?: string; modelId: string } {
  const parts = modelString.split(':');
  if (parts.length === 2) {
    return { providerId: parts[0], modelId: parts[1]! };
  }
  return { modelId: modelString };
}

/**
 * Format a model string from provider and model IDs
 */
export function formatModelString(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff with jitter
 */
export function calculateBackoff(attempt: number, baseMs = 1000, maxMs = 30000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = exponential * 0.2 * Math.random();
  return Math.floor(exponential + jitter);
}

/**
 * Redact sensitive information from strings
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***')
    .replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/g, 'Bearer ***')
    .replace(/"api_key":\s*"[^"]+"/g, '"api_key": "***"')
    .replace(/"apiKey":\s*"[^"]+"/g, '"apiKey": "***"');
}

/**
 * Deep clone an object (simple JSON-safe implementation)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if a value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  const source = sources.shift();
  if (!source) return target;

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = (target as Record<string, unknown>)[key];

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      (target as Record<string, unknown>)[key] = deepMerge({ ...targetValue }, sourceValue);
    } else if (sourceValue !== undefined) {
      (target as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost based on token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  costPerInputToken: number,
  costPerOutputToken: number
): number {
  return inputTokens * costPerInputToken + outputTokens * costPerOutputToken;
}
