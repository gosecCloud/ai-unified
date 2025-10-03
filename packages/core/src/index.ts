/**
 * @aiu/core - Core types, errors, and utilities for AI Unified
 */

// Types
export type {
  ModelKind,
  Modality,
  ProviderInfo,
  ModelInfo,
  MessageRole,
  MessageContent,
  Message,
  Tool,
  ToolCall,
  AIRequest,
  ChatRequest,
  EmbedRequest,
  TranscribeRequest,
  TranscribeResponse,
  SpeechRequest,
  SpeechResponse,
  ImageRequest,
  ImageResponse,
  RerankRequest,
  RerankResponse,
  Usage,
  AIResponse,
  ChatResponse,
  EmbedResponse,
  StreamChunk,
  ChatDelta,
  ProviderAdapter,
  KeyStatus,
  ApiKeyInfo,
  RequestLog,
  // Agent types
  AgentCapability,
  WorkspacePolicy,
  SandboxProfile,
  AgentEventType,
  AgentEvent,
  Artifact,
  AgentRunResult,
  AgentJob,
  AgentAdapter,
} from './types.js';

// Errors
export {
  AIUError,
  type AIUErrorCode,
  type AIUErrorOptions,
  badApiKeyError,
  rateLimitError,
  timeoutError,
  providerDownError,
  modelNotFoundError,
  unsupportedFeatureError,
  validationError,
  networkError,
  parsingError,
  storageError,
  encryptionError,
} from './errors.js';

// Events
export {
  AIUEventEmitter,
  type AIUEventType,
  type AIUEvent,
  type RequestStartEvent,
  type RequestSuccessEvent,
  type RequestErrorEvent,
  type RequestRetryEvent,
  type StreamChunkEvent,
  type EventHandler,
} from './events.js';

// Utils
export {
  parseModelString,
  formatModelString,
  generateRequestId,
  sleep,
  calculateBackoff,
  redactSecrets,
  deepClone,
  isPlainObject,
  deepMerge,
  estimateTokens,
  calculateCost,
} from './utils.js';
