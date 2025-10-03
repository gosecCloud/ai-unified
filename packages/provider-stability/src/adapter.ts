/**
 * Stability AI provider adapter
 *
 * Supports Stable Diffusion image generation models
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  ImageRequest,
  ImageResponse,
} from '@aiu/core';
import { HttpClient } from '@aiu/transport';
import { parsingError, validationError } from '@aiu/core';

const BASE_URL = 'https://api.stability.ai/v1';

// Static model catalog
const STABILITY_MODELS: ModelInfo[] = [
  {
    providerId: 'stability',
    modelId: 'stable-diffusion-v3',
    kind: 'image',
    contextWindow: 77, // Text prompt tokens
    maxOutputTokens: 0,
    modalities: ['text', 'image'],
    deprecated: false,
    costPerInputToken: 0.00002, // Estimated per image generation
    costPerOutputToken: 0,
  },
  {
    providerId: 'stability',
    modelId: 'stable-diffusion-xl-1024-v1-0',
    kind: 'image',
    contextWindow: 77,
    maxOutputTokens: 0,
    modalities: ['text', 'image'],
    deprecated: false,
    costPerInputToken: 0.00003,
    costPerOutputToken: 0,
  },
  {
    providerId: 'stability',
    modelId: 'stable-diffusion-xl-beta-v2-2-2',
    kind: 'image',
    contextWindow: 77,
    maxOutputTokens: 0,
    modalities: ['text', 'image'],
    deprecated: true,
    costPerInputToken: 0.00002,
    costPerOutputToken: 0,
  },
];

interface StabilityImageResponse {
  artifacts: Array<{
    base64: string;
    finishReason: string;
    seed: number;
  }>;
}

export interface StabilityAdapterOptions {
  baseUrl?: string;
  apiVersion?: string;
}

export class StabilityAdapter implements ProviderAdapter {
  private http: HttpClient;
  private baseUrl: string;

  constructor(options: StabilityAdapterOptions = {}) {
    this.http = new HttpClient({
      timeoutMs: 300000, // 5 minutes for image generation
      maxRetries: 2,
    });
    this.baseUrl = options.baseUrl || BASE_URL;
  }

  info(): ProviderInfo {
    return {
      id: 'stability',
      name: 'Stability AI',
      supports: ['image'],
      endpoints: {
        image: `${this.baseUrl}/generation`,
      },
    };
  }

  async validateApiKey(key: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      await this.http.request(
        `${this.baseUrl}/user/account`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${key}` },
        },
        'stability'
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
    // Stability AI doesn't have a models endpoint
    // Return static catalog
    return STABILITY_MODELS;
  }

  async chat(_req: ChatRequest, _key: string): Promise<ChatResponse> {
    throw validationError('Stability AI does not support chat completions');
  }

  async image(req: ImageRequest, key: string): Promise<ImageResponse> {
    const modelId = req.model.includes(':') ? req.model.split(':')[1] : req.model;

    // Build request payload
    const body: any = {
      text_prompts: [{ text: req.input }],
      cfg_scale: 7, // Guidance scale
      samples: req.options?.n ?? 1,
      steps: 30, // Inference steps
    };

    // Map size option
    if (req.options?.size) {
      const [width, height] = req.options.size.split('x').map(Number);
      body.width = width;
      body.height = height;
    } else {
      body.width = 1024;
      body.height = 1024;
    }

    // Additional options
    if (req.options?.seed !== undefined) {
      body.seed = req.options.seed;
    }

    const response = await this.http.request<StabilityImageResponse>(
      `${this.baseUrl}/generation/${modelId}/text-to-image`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
      },
      'stability'
    );

    if (!response.artifacts || response.artifacts.length === 0) {
      throw parsingError('stability', 'No images generated');
    }

    return {
      providerId: 'stability',
      modelId: modelId!,
      images: response.artifacts.map((artifact) => ({
        b64_json: artifact.base64,
      })),
    };
  }
}
