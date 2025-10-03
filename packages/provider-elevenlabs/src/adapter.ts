/**
 * ElevenLabs provider adapter
 *
 * Supports text-to-speech with voice cloning
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  SpeechRequest,
  SpeechResponse,
} from '@aiu/core';
import { HttpClient } from '@aiu/transport';
import { validationError } from '@aiu/core';

const BASE_URL = 'https://api.elevenlabs.io/v1';

// Static model catalog (voices are treated as models)
const ELEVENLABS_MODELS: ModelInfo[] = [
  {
    providerId: 'elevenlabs',
    modelId: 'eleven_monolingual_v1',
    kind: 'audio',
    contextWindow: 5000, // Characters
    maxOutputTokens: 0,
    modalities: ['text', 'audio'],
    deprecated: false,
    costPerInputToken: 0.0003, // Per character (estimated)
    costPerOutputToken: 0,
  },
  {
    providerId: 'elevenlabs',
    modelId: 'eleven_multilingual_v2',
    kind: 'audio',
    contextWindow: 5000,
    maxOutputTokens: 0,
    modalities: ['text', 'audio'],
    deprecated: false,
    costPerInputToken: 0.0003,
    costPerOutputToken: 0,
  },
  {
    providerId: 'elevenlabs',
    modelId: 'eleven_turbo_v2',
    kind: 'audio',
    contextWindow: 5000,
    maxOutputTokens: 0,
    modalities: ['text', 'audio'],
    deprecated: false,
    costPerInputToken: 0.0002, // Faster, cheaper
    costPerOutputToken: 0,
  },
];

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

export interface ElevenLabsAdapterOptions {
  baseUrl?: string;
  defaultVoice?: string;
}

export class ElevenLabsAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;
  private defaultVoice: string;

  constructor(options: ElevenLabsAdapterOptions = {}) {
    this.http = new HttpClient({
      timeoutMs: 120000,
      maxRetries: 2,
    });
    this.baseUrl = options.baseUrl || BASE_URL;
    this.defaultVoice = options.defaultVoice || 'EXAVITQu4vr4xnSDxMaL'; // Default: Bella
  }

  info(): ProviderInfo {
    return {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      supports: ['audio'],
      endpoints: {
        audio: `${this.baseUrl}/text-to-speech`,
        voices: `${this.baseUrl}/voices`,
      },
    };
  }

  async validateApiKey(key: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      await this.http.request(
        `${this.baseUrl}/user`,
        {
          method: 'GET',
          headers: { 'xi-api-key': key },
        },
        'elevenlabs'
      );
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Invalid API key',
      };
    }
  }

  async listModels(_key: string): Promise<ModelInfo[]> {
    // ElevenLabs uses voices, not models
    // Return static model list
    return ELEVENLABS_MODELS;
  }

  async chat(_req: ChatRequest, _key: string): Promise<ChatResponse> {
    throw validationError('ElevenLabs does not support chat completions');
  }

  async audio(req: SpeechRequest, key: string): Promise<SpeechResponse> {
    const modelId = req.model.includes(':') ? req.model.split(':')[1] : req.model;
    const voiceId = req.options?.voice || this.defaultVoice;

    // Build request payload
    const body = {
      text: req.input,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    };

    // ElevenLabs returns audio as binary
    const response = await this.http.request<ArrayBuffer>(
      `${this.baseUrl}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body,
        responseType: 'arrayBuffer', // Request binary response
      },
      'elevenlabs'
    );

    return {
      providerId: 'elevenlabs',
      modelId: modelId!,
      audio: new Uint8Array(response),
      format: 'mp3',
    };
  }

  /**
   * Get available voices
   */
  async getVoices(key: string): Promise<ElevenLabsVoice[]> {
    interface VoicesResponse {
      voices: ElevenLabsVoice[];
    }

    const response = await this.http.request<VoicesResponse>(
      `${this.baseUrl}/voices`,
      {
        method: 'GET',
        headers: { 'xi-api-key': key },
      },
      'elevenlabs'
    );

    return response.voices;
  }
}
