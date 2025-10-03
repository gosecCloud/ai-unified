/**
 * Core type definitions for AI Unified
 */

/** Supported model capabilities */
export type ModelKind = 'chat' | 'embed' | 'image' | 'audio' | 'rerank' | 'tool';

/** Model input/output modalities */
export type Modality = 'text' | 'image' | 'audio' | 'video';

/** Provider information and capabilities */
export interface ProviderInfo {
  /** Unique provider identifier (e.g., "openai", "anthropic") */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Model kinds this provider supports */
  supports: ModelKind[];
  /** API endpoints for different capabilities */
  endpoints: Record<string, string>;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
  /** Rate limit information */
  rateLimit?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
}

/** Model information and specifications */
export interface ModelInfo {
  /** Provider that offers this model */
  providerId: string;
  /** Model identifier (e.g., "gpt-4o-mini", "claude-3.5-sonnet") */
  modelId: string;
  /** Primary capability of this model */
  kind: ModelKind;
  /** Context window size in tokens */
  contextWindow?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Supported input/output modalities */
  modalities?: Modality[];
  /** Whether this model is deprecated */
  deprecated?: boolean;
  /** Cost per input token (USD) */
  costPerInputToken?: number;
  /** Cost per output token (USD) */
  costPerOutputToken?: number;
  /** Additional model metadata */
  metadata?: Record<string, unknown>;
}

/** Chat message role */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** Chat message content part */
export type MessageContent =
  | string
  | { type: 'text'; text: string }
  | { type: 'image'; image: string | { url: string } | { base64: string } }
  | { type: 'audio'; audio: string | { url: string } | { base64: string } };

/** Chat message */
export interface Message {
  role: MessageRole;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/** Tool/function definition */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/** Tool call from the model */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/** Unified AI request */
export interface AIRequest {
  /** Model identifier in format "provider:model" or alias */
  model: string;
  /** Request input (varies by model kind) */
  input: unknown;
  /** Optional parameters */
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: Tool[];
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    stop?: string | string[];
    seed?: number;
    timeoutMs?: number;
    [key: string]: unknown;
  };
  /** Request metadata for tracking */
  metadata?: Record<string, string>;
}

/** Chat-specific request */
export interface ChatRequest extends Omit<AIRequest, 'input'> {
  input: Message[];
}

/** Embedding request */
export interface EmbedRequest extends Omit<AIRequest, 'input'> {
  input: string | string[];
}

/** Image generation request */
export interface ImageRequest extends Omit<AIRequest, 'input'> {
  input: string; // Text prompt
  options?: {
    n?: number; // Number of images to generate
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
    response_format?: 'url' | 'b64_json';
    [key: string]: unknown;
  };
}

/** Audio transcription request (speech-to-text) */
export interface TranscribeRequest extends Omit<AIRequest, 'input'> {
  input: string | Buffer | { url: string } | { base64: string }; // Audio file or URL
  options?: {
    language?: string; // ISO language code
    prompt?: string; // Context hint for better accuracy
    response_format?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
    temperature?: number;
    [key: string]: unknown;
  };
}

/** Text-to-speech request */
export interface SpeechRequest extends Omit<AIRequest, 'input'> {
  input: string; // Text to convert to speech
  options?: {
    voice?: string; // Voice ID or name
    speed?: number; // Playback speed (0.25 to 4.0)
    response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';
    [key: string]: unknown;
  };
}

/** Document for reranking */
export interface RerankDocument {
  text: string;
  [key: string]: unknown; // Additional metadata
}

/** Rerank request */
export interface RerankRequest extends Omit<AIRequest, 'input'> {
  query: string; // Search query
  documents: Array<string | RerankDocument>; // Documents to rerank
  options?: {
    top_n?: number; // Return top N results
    return_documents?: boolean; // Include documents in response
    [key: string]: unknown;
  };
}

/** Usage statistics */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Unified AI response */
export interface AIResponse<T = unknown> {
  /** Model that generated this response */
  model: string;
  /** Unique response identifier */
  id: string;
  /** Unix timestamp of creation */
  created: number;
  /** Response output */
  output: T;
  /** Token usage statistics */
  usage?: Usage;
  /** Finish reason */
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  /** Raw provider response for debugging */
  raw?: unknown;
}

/** Chat response */
export interface ChatResponse extends AIResponse<Message> {
  output: Message;
}

/** Embedding response */
export interface EmbedResponse {
  providerId: string;
  modelId: string;
  embeddings: number[][];
  usage?: {
    totalTokens: number;
  };
}

/** Image generation response */
export interface ImageResponse {
  providerId: string;
  modelId: string;
  images: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  usage?: {
    totalTokens?: number;
  };
}

/** Transcription response */
export interface TranscribeResponse {
  providerId: string;
  modelId: string;
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  usage?: {
    totalTokens?: number;
  };
}

/** Text-to-speech response */
export interface SpeechResponse {
  providerId: string;
  modelId: string;
  audio: Uint8Array | ArrayBuffer | string; // Audio data (Uint8Array/ArrayBuffer) or URL (string)
  format: string;
  usage?: {
    totalTokens?: number;
  };
}

/** Rerank result */
export interface RerankResult {
  index: number;
  relevance_score: number;
  document?: string | RerankDocument;
}

/** Rerank response */
export interface RerankResponse {
  providerId: string;
  modelId: string;
  results: RerankResult[];
  usage?: {
    totalTokens?: number;
  };
}

/** Streaming chunk */
export interface StreamChunk<T = unknown> {
  delta: T;
  raw?: unknown;
}

/** Chat streaming delta */
export interface ChatDelta {
  role?: MessageRole;
  content?: string;
  tool_calls?: Partial<ToolCall>[];
}

/** Provider adapter interface */
export interface ProviderAdapter {
  /** Get provider information */
  info(): ProviderInfo;

  /** Validate an API key */
  validateApiKey(key: string): Promise<{ valid: boolean; reason?: string; scopes?: string[] }>;

  /** List available models */
  listModels(key: string): Promise<ModelInfo[]>;

  /** Execute a chat request */
  chat(req: ChatRequest, key: string): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>>;

  /** Generate embeddings */
  embed?(req: EmbedRequest, key: string): Promise<EmbedResponse>;

  /** Generate images */
  image?(req: ImageRequest, key: string): Promise<ImageResponse>;

  /** Transcribe or generate audio */
  audio?(req: TranscribeRequest | SpeechRequest, key: string): Promise<TranscribeResponse | SpeechResponse>;

  /** Rerank documents */
  rerank?(req: RerankRequest, key: string): Promise<RerankResponse>;
}

/** API key status */
export type KeyStatus = 'active' | 'invalid' | 'expired' | 'revoked';

/** Stored API key information */
export interface ApiKeyInfo {
  id: string;
  providerId: string;
  alias: string;
  keyCiphertext: string;
  status: KeyStatus;
  scopes?: string[];
  createdAt: Date;
  lastValidatedAt?: Date;
  metadata?: Record<string, unknown>;
}

/** Request log entry */
export interface RequestLog {
  id: string;
  timestamp: Date;
  providerId: string;
  modelId: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  status: 'success' | 'error' | 'timeout' | 'rate_limited';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * =========================================================================
 * CODING AGENTS - Types for autonomous coding agents layer
 * =========================================================================
 */

/** Agent capabilities */
export type AgentCapability =
  | 'code-edit'      // Edit existing code
  | 'code-generate'  // Generate new code
  | 'code-review'    // Review and analyze code
  | 'code-test'      // Write/run tests
  | 'code-debug'     // Debug and fix issues
  | 'code-refactor'  // Refactor code
  | 'shell'          // Execute shell commands
  | 'file-read'      // Read files
  | 'file-write'     // Write files
  | 'git'            // Git operations
  | 'web-search'     // Search the web
  | 'web-fetch';     // Fetch web content

/** Workspace policy for path restrictions */
export interface WorkspacePolicy {
  /** Allowed paths (glob patterns) */
  allowedPaths: string[];
  /** Forbidden paths (glob patterns) */
  forbiddenPaths: string[];
  /** Allowed shell commands (regex patterns) */
  allowedCommands?: string[];
  /** Forbidden shell commands (regex patterns) */
  forbiddenCommands?: string[];
  /** Maximum file size in bytes */
  maxFileSizeBytes?: number;
  /** Maximum files per operation */
  maxFilesPerOp?: number;
}

/** Sandbox profile for agent execution */
export interface SandboxProfile {
  /** Profile name */
  name: string;
  /** Allow network access */
  allowNetwork: boolean;
  /** Allow shell commands */
  allowShell: boolean;
  /** Execution timeout in milliseconds */
  timeoutMs: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory override */
  cwd?: string;
}

/** Agent event types */
export type AgentEventType =
  | 'task_start'
  | 'task_complete'
  | 'tool_use'
  | 'file_edit'
  | 'file_create'
  | 'shell_exec'
  | 'thinking'
  | 'error'
  | 'progress';

/** Agent event */
export interface AgentEvent {
  /** Event ID */
  id: string;
  /** Agent run ID */
  runId: string;
  /** Event type */
  type: AgentEventType;
  /** Unix timestamp */
  timestamp: number;
  /** Event data */
  data: Record<string, unknown>;
  /** Sequence number */
  sequence: number;
}

/** File artifact produced by agent */
export interface Artifact {
  /** Artifact ID */
  id: string;
  /** Agent run ID */
  runId: string;
  /** File path */
  path: string;
  /** Operation type */
  operation: 'create' | 'update' | 'delete';
  /** File content (for create/update) */
  content?: string;
  /** Diff (for updates) */
  diff?: string;
  /** Unix timestamp */
  timestamp: number;
}

/** Agent run result */
export interface AgentRunResult {
  /** Run ID */
  runId: string;
  /** Status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Exit code (0 = success) */
  exitCode?: number;
  /** Start time */
  startedAt: Date;
  /** End time */
  completedAt?: Date;
  /** Total tokens used */
  tokensUsed?: number;
  /** Cost in USD */
  cost?: number;
  /** Artifacts produced */
  artifacts: Artifact[];
  /** Events log */
  events: AgentEvent[];
  /** Error message (if failed) */
  errorMessage?: string;
}

/** Agent job definition */
export interface AgentJob {
  /** Job ID */
  id: string;
  /** Workspace ID */
  workspaceId: string;
  /** Agent ID */
  agentId: string;
  /** Task description */
  task: string;
  /** Initial context files */
  contextFiles?: string[];
  /** Sandbox profile */
  profile: SandboxProfile;
  /** Status */
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** User-provided metadata */
  metadata?: Record<string, unknown>;
}

/** Agent adapter interface */
export interface AgentAdapter {
  /** Get agent information */
  info(): {
    id: string;
    name: string;
    version: string;
    capabilities: AgentCapability[];
    binaryPath: string;
    requiredEnv?: string[];
  };

  /** Detect if agent CLI is installed */
  detect(): Promise<{ installed: boolean; version?: string; path?: string }>;

  /** Validate authentication */
  validateAuth(): Promise<{ valid: boolean; reason?: string }>;

  /** Execute a coding task */
  execute(job: AgentJob): AsyncIterable<AgentEvent>;

  /** Cancel a running job */
  cancel(runId: string): Promise<void>;

  /** Get run status */
  getRunStatus(runId: string): Promise<AgentRunResult>;
}
