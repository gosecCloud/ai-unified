/**
 * AssemblyAI provider adapter
 *
 * Supports audio transcription with advanced features (speaker diarization, sentiment analysis)
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  TranscribeRequest,
  TranscribeResponse,
} from '@aiu/core';
import { HttpClient } from '@aiu/transport';
import { validationError, parsingError } from '@aiu/core';

const BASE_URL = 'https://api.assemblyai.com/v2';

// Static model catalog
const ASSEMBLYAI_MODELS: ModelInfo[] = [
  {
    providerId: 'assemblyai',
    modelId: 'best',
    kind: 'audio',
    contextWindow: 0, // Audio length in seconds (unlimited)
    maxOutputTokens: 0,
    modalities: ['audio', 'text'],
    deprecated: false,
    costPerInputToken: 0.00037, // Per second of audio
    costPerOutputToken: 0,
  },
  {
    providerId: 'assemblyai',
    modelId: 'nano',
    kind: 'audio',
    contextWindow: 0,
    maxOutputTokens: 0,
    modalities: ['audio', 'text'],
    deprecated: false,
    costPerInputToken: 0.00015, // Cheaper, faster
    costPerOutputToken: 0,
  },
];

interface AssemblyAIUploadResponse {
  upload_url: string;
}

interface AssemblyAITranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text: string;
  audio_duration: number;
  language_code?: string;
  utterances?: Array<{
    start: number;
    end: number;
    text: string;
    speaker: string;
  }>;
  words?: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  error?: string;
}

export interface AssemblyAIAdapterOptions {
  baseUrl?: string;
  pollingInterval?: number;
}

export class AssemblyAIAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;
  private pollingInterval: number;

  constructor(options: AssemblyAIAdapterOptions = {}) {
    this.http = new HttpClient({
      timeoutMs: 300000, // 5 minutes for long audio
      maxRetries: 2,
    });
    this.baseUrl = options.baseUrl || BASE_URL;
    this.pollingInterval = options.pollingInterval || 3000; // 3 seconds
  }

  info(): ProviderInfo {
    return {
      id: 'assemblyai',
      name: 'AssemblyAI',
      supports: ['audio'],
      endpoints: {
        audio: `${this.baseUrl}/transcript`,
        upload: `${this.baseUrl}/upload`,
      },
    };
  }

  async validateApiKey(key: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Use lightweight GET endpoint to validate key (lists recent transcripts)
      // This is read-only with no side effects, unlike POST /transcript
      await this.http.request(
        `${this.baseUrl}/transcript`,
        {
          method: 'GET',
          headers: { authorization: key },
        },
        'assemblyai'
      );
      return { valid: true };
    } catch (error: any) {
      // HTTP 401 = invalid key, 403 = insufficient permissions
      return {
        valid: false,
        reason: error.message || 'Invalid API key',
      };
    }
  }

  async listModels(_key: string): Promise<ModelInfo[]> {
    return ASSEMBLYAI_MODELS;
  }

  async chat(_req: ChatRequest, _key: string): Promise<ChatResponse> {
    throw validationError('AssemblyAI does not support chat completions');
  }

  async audio(req: TranscribeRequest, key: string): Promise<TranscribeResponse> {
    const modelId = req.model.includes(':') ? (req.model.split(':')[1] || 'best') : req.model;

    // Step 1: Upload audio if needed
    let audioUrl: string;

    if (typeof req.input === 'string') {
      // Assume it's already a URL
      audioUrl = req.input;
    } else if (Buffer.isBuffer(req.input)) {
      // Upload buffer
      audioUrl = await this.uploadAudio(req.input, key);
    } else if ('url' in req.input) {
      audioUrl = req.input.url;
    } else if ('base64' in req.input) {
      const audioBuffer = Buffer.from(req.input.base64, 'base64');
      audioUrl = await this.uploadAudio(audioBuffer, key);
    } else {
      throw validationError('Invalid audio input format');
    }

    // Step 2: Create transcription job
    const body: any = {
      audio_url: audioUrl,
      speech_model: modelId === 'nano' ? 'nano' : undefined,
    };

    // Add options
    if (req.options?.language) {
      body.language_code = req.options.language;
    }

    const transcript = await this.http.request<AssemblyAITranscript>(
      `${this.baseUrl}/transcript`,
      {
        method: 'POST',
        headers: {
          authorization: key,
          'Content-Type': 'application/json',
        },
        body,
      },
      'assemblyai'
    );

    // Step 3: Poll for completion
    const completedTranscript = await this.pollTranscript(transcript.id, key);

    if (completedTranscript.status === 'error') {
      throw parsingError('assemblyai', completedTranscript.error || 'Transcription failed');
    }

    // Map to standard response
    const segments = completedTranscript.utterances?.map((utterance, index) => ({
      id: index,
      start: utterance.start / 1000, // Convert ms to seconds
      end: utterance.end / 1000,
      text: utterance.text,
    }));

    return {
      providerId: 'assemblyai',
      modelId,
      text: completedTranscript.text,
      language: completedTranscript.language_code,
      duration: completedTranscript.audio_duration,
      segments,
    };
  }

  private async uploadAudio(audioBuffer: Buffer, key: string): Promise<string> {
    const response = await this.http.request<AssemblyAIUploadResponse>(
      `${this.baseUrl}/upload`,
      {
        method: 'POST',
        headers: {
          authorization: key,
          'Content-Type': 'application/octet-stream',
        },
        body: audioBuffer,
        isRawBody: true, // Don't JSON.stringify the buffer
      },
      'assemblyai'
    );

    return response.upload_url;
  }

  private async pollTranscript(transcriptId: string, key: string): Promise<AssemblyAITranscript> {
    while (true) {
      const transcript = await this.http.request<AssemblyAITranscript>(
        `${this.baseUrl}/transcript/${transcriptId}`,
        {
          method: 'GET',
          headers: { authorization: key },
        },
        'assemblyai'
      );

      if (transcript.status === 'completed' || transcript.status === 'error') {
        return transcript;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
    }
  }
}
