/**
 * OpenAI provider adapter
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
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
  StreamChunk,
  ChatDelta,
  Message,
} from '@aiu/core';
import { HttpClient } from '@aiu/transport';
import { parseSSEJSON } from '@aiu/transport';
import { parsingError } from '@aiu/core';

const BASE_URL = 'https://api.openai.com/v1';

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIChatStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIAdapter implements ProviderAdapter {
  private http: HttpClient;

  constructor() {
    this.http = new HttpClient({
      timeoutMs: 120000,
      maxRetries: 3,
    });
  }

  info(): ProviderInfo {
    return {
      id: 'openai',
      name: 'OpenAI',
      supports: ['chat', 'embed', 'image', 'audio'],
      endpoints: {
        chat: '/v1/chat/completions',
        embed: '/v1/embeddings',
        images: '/v1/images/generations',
        audio: '/v1/audio',
      },
    };
  }

  async validateApiKey(key: string): Promise<{ valid: boolean; reason?: string; scopes?: string[] }> {
    try {
      await this.http.request(
        `${BASE_URL}/models`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${key}` },
        },
        'openai'
      );
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listModels(key: string): Promise<ModelInfo[]> {
    const response = await this.http.request<{ data: OpenAIModel[] }>(
      `${BASE_URL}/models`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      },
      'openai'
    );

    return response.data
      .filter((model) => this.isRelevantModel(model.id))
      .map((model) => this.mapModelInfo(model));
  }

  async chat(req: ChatRequest, key: string): Promise<ChatResponse | AsyncIterable<StreamChunk<ChatDelta>>> {
    const payload = {
      model: req.model.includes(':') ? req.model.split(':')[1] : req.model,
      messages: req.input.map((msg) => this.mapMessage(msg)),
      temperature: req.options?.temperature,
      top_p: req.options?.top_p,
      max_tokens: req.options?.max_tokens,
      stream: req.options?.stream ?? false,
      tools: req.options?.tools,
      tool_choice: req.options?.tool_choice,
      stop: req.options?.stop,
      seed: req.options?.seed,
    };

    if (req.options?.stream) {
      return this.streamChat(payload, key);
    }

    const response = await this.http.request<OpenAIChatResponse>(
      `${BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: payload,
      },
      'openai'
    );

    return this.mapChatResponse(response);
  }

  async embed(req: EmbedRequest, key: string): Promise<EmbedResponse> {
    const payload = {
      model: req.model.includes(':') ? req.model.split(':')[1] : req.model,
      input: req.input,
    };

    const response = await this.http.request<OpenAIEmbeddingResponse>(
      `${BASE_URL}/embeddings`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: payload,
      },
      'openai'
    );

    return {
      providerId: 'openai',
      modelId: response.model,
      embeddings: response.data.map((d) => d.embedding),
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  async image(req: ImageRequest, key: string): Promise<ImageResponse> {
    const payload = {
      model: req.model.includes(':') ? req.model.split(':')[1] : req.model,
      prompt: req.input,
      n: req.options?.n ?? 1,
      size: req.options?.size ?? '1024x1024',
      quality: req.options?.quality ?? 'standard',
      style: req.options?.style,
      response_format: req.options?.response_format ?? 'url',
    };

    interface OpenAIImageResponse {
      created: number;
      data: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
      }>;
    }

    const response = await this.http.request<OpenAIImageResponse>(
      `${BASE_URL}/images/generations`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: payload,
      },
      'openai'
    );

    return {
      providerId: 'openai',
      modelId: payload.model!,
      images: response.data,
    };
  }

  async audio(req: TranscribeRequest | SpeechRequest, key: string): Promise<TranscribeResponse | SpeechResponse> {
    const modelId = req.model.includes(':') ? req.model.split(':')[1]! : req.model;

    // Determine if this is transcription or TTS based on model or input type
    if ('input' in req && typeof req.input === 'string' && (modelId!.includes('tts') || modelId === 'tts-1' || modelId === 'tts-1-hd')) {
      // Text-to-speech
      return this.textToSpeech(req as SpeechRequest, key);
    } else {
      // Transcription
      return this.transcribeAudio(req as TranscribeRequest, key);
    }
  }

  private async transcribeAudio(req: TranscribeRequest, key: string): Promise<TranscribeResponse> {
    const modelId = req.model.includes(':') ? req.model.split(':')[1] : req.model;

    // Build form data for audio file upload
    const formData = new FormData();
    formData.append('model', modelId);

    // Handle different input types
    if (typeof req.input === 'string') {
      // Assume it's a file path or URL
      formData.append('file', req.input);
    } else if (Buffer.isBuffer(req.input)) {
      formData.append('file', new Blob([req.input]));
    } else if ('url' in req.input) {
      // Fetch URL and upload
      const audioResponse = await fetch(req.input.url);
      const audioBlob = await audioResponse.blob();
      formData.append('file', audioBlob);
    } else if ('base64' in req.input) {
      const audioBuffer = Buffer.from(req.input.base64, 'base64');
      formData.append('file', new Blob([audioBuffer]));
    }

    if (req.options?.language) formData.append('language', req.options.language);
    if (req.options?.prompt) formData.append('prompt', req.options.prompt);
    if (req.options?.response_format) formData.append('response_format', req.options.response_format);
    if (req.options?.temperature) formData.append('temperature', String(req.options.temperature));

    interface OpenAITranscriptionResponse {
      text: string;
      language?: string;
      duration?: number;
      segments?: Array<{
        id: number;
        start: number;
        end: number;
        text: string;
      }>;
    }

    const response = await this.http.request<OpenAITranscriptionResponse>(
      `${BASE_URL}/audio/transcriptions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: formData,
      },
      'openai'
    );

    return {
      providerId: 'openai',
      modelId: modelId!,
      text: response.text,
      language: response.language,
      duration: response.duration,
      segments: response.segments,
    };
  }

  private async textToSpeech(req: SpeechRequest, key: string): Promise<SpeechResponse> {
    const modelId = req.model.includes(':') ? req.model.split(':')[1] : req.model;

    const payload = {
      model: modelId,
      input: req.input,
      voice: req.options?.voice ?? 'alloy',
      speed: req.options?.speed ?? 1.0,
      response_format: req.options?.response_format ?? 'mp3',
    };

    // OpenAI returns raw audio buffer
    const response = await this.http.request<ArrayBuffer>(
      `${BASE_URL}/audio/speech`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: payload,
        responseType: 'arrayBuffer',
      },
      'openai'
    );

    return {
      providerId: 'openai',
      modelId: modelId!,
      audio: new Uint8Array(response),
      format: payload.response_format,
    };
  }

  private async *streamChat(payload: any, key: string): AsyncIterable<StreamChunk<ChatDelta>> {
    const stream = await this.http.stream(
      `${BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: payload,
      },
      'openai'
    );

    for await (const chunk of parseSSEJSON<OpenAIChatStreamChunk>(stream)) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta: ChatDelta = {};

      if (choice.delta.role) {
        delta.role = choice.delta.role as any;
      }

      if (choice.delta.content) {
        delta.content = choice.delta.content;
      }

      if (choice.delta.tool_calls) {
        delta.tool_calls = choice.delta.tool_calls as any;
      }

      yield { delta, raw: chunk };
    }
  }

  private mapMessage(msg: Message): any {
    return {
      role: msg.role,
      content: msg.content, // OpenAI supports both string and array content natively
      name: msg.name,
      tool_call_id: msg.tool_call_id,
      tool_calls: msg.tool_calls,
    };
  }

  private mapChatResponse(response: OpenAIChatResponse): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw parsingError('openai', 'No choices in response');
    }

    return {
      model: response.model,
      id: response.id,
      created: response.created * 1000,
      output: {
        role: choice.message.role as any,
        content: choice.message.content,
        tool_calls: choice.message.tool_calls as any,
      },
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason as any,
      raw: response,
    };
  }

  private isRelevantModel(id: string): boolean {
    // Filter out non-chat/embed models
    return (
      id.includes('gpt') ||
      id.includes('text-embedding') ||
      id.includes('davinci') ||
      id.includes('curie') ||
      id.includes('babbage') ||
      id.includes('ada')
    );
  }

  private mapModelInfo(model: OpenAIModel): ModelInfo {
    const id = model.id;
    let kind: ModelInfo['kind'] = 'chat';
    let contextWindow = 4096;
    let maxOutputTokens = 4096;

    // Determine model kind and specs
    if (id.includes('embedding')) {
      kind = 'embed';
      contextWindow = 8191;
    } else if (id.includes('gpt-4o')) {
      contextWindow = 128000;
      maxOutputTokens = 16384;
    } else if (id.includes('gpt-4-turbo') || id.includes('gpt-4-1106')) {
      contextWindow = 128000;
      maxOutputTokens = 4096;
    } else if (id.includes('gpt-4-32k')) {
      contextWindow = 32768;
      maxOutputTokens = 8192;
    } else if (id.includes('gpt-4')) {
      contextWindow = 8192;
      maxOutputTokens = 4096;
    } else if (id.includes('gpt-3.5-turbo-16k')) {
      contextWindow = 16384;
      maxOutputTokens = 4096;
    } else if (id.includes('gpt-3.5')) {
      contextWindow = 4096;
      maxOutputTokens = 4096;
    }

    return {
      providerId: 'openai',
      modelId: id,
      kind,
      contextWindow,
      maxOutputTokens,
      modalities: ['text'],
      deprecated: false,
    };
  }
}
