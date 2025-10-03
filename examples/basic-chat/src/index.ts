/**
 * Basic Chat Example - Demonstrates AI Unified usage
 */

import { Keyring } from '@aiu/keyring';
import { OpenAIAdapter } from '@aiu/provider-openai';
import { AnthropicAdapter } from '@aiu/provider-anthropic';
import { ModelRegistry } from '@aiu/model-registry';
import { createLogger, defaultMetrics } from '@aiu/observability';
import { generateRequestId } from '@aiu/core';

async function main() {
  const logger = createLogger({ level: 'info', pretty: true });
  logger.info('🤖 AI Unified - Basic Chat Example');

  // 1. Initialize keyring with master key
  logger.info('🔐 Initializing keyring...');
  const masterKey = Keyring.generateMasterKey();
  const keyring = new Keyring({ masterKey });

  // 2. Store API keys (encrypted)
  // In production, load from environment or secure vault
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiKey && !anthropicKey) {
    logger.error('❌ No API keys found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
    process.exit(1);
  }

  if (openaiKey) {
    keyring.save({
      providerId: 'openai',
      alias: 'default',
      key: openaiKey,
    });
    logger.info('✅ OpenAI key stored');
  }

  if (anthropicKey) {
    keyring.save({
      providerId: 'anthropic',
      alias: 'default',
      key: anthropicKey,
    });
    logger.info('✅ Anthropic key stored');
  }

  // 3. Register providers
  logger.info('📦 Registering providers...');
  const openai = new OpenAIAdapter();
  const anthropic = new AnthropicAdapter();

  const registry = new ModelRegistry();
  registry.registerProvider(openai);
  registry.registerProvider(anthropic);

  // 4. Validate keys and discover models
  if (openaiKey) {
    const validation = await openai.validateApiKey(openaiKey);
    logger.info({ valid: validation.valid }, 'OpenAI key validation');

    if (validation.valid) {
      const models = await openai.listModels(openaiKey);
      logger.info({ count: models.length }, 'OpenAI models discovered');
    }
  }

  if (anthropicKey) {
    const validation = await anthropic.validateApiKey(anthropicKey);
    logger.info({ valid: validation.valid }, 'Anthropic key validation');

    if (validation.valid) {
      const models = await anthropic.listModels(anthropicKey);
      logger.info({ count: models.length }, 'Anthropic models available');
    }
  }

  // 5. Non-streaming chat example
  if (openaiKey) {
    logger.info('💬 Testing OpenAI chat (non-streaming)...');
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      const response = await openai.chat(
        {
          model: 'gpt-4o-mini',
          input: [
            {
              role: 'user',
              content: 'Explain quantum entanglement in one short sentence.',
            },
          ],
          options: {
            temperature: 0.7,
            max_tokens: 100,
          },
        },
        openaiKey
      );

      const latency = Date.now() - startTime;

      // Type guard for non-streaming response
      if ('output' in response) {
        logger.info(
          {
            requestId,
            latency,
            tokens: response.usage?.totalTokens,
          },
          'OpenAI response received'
        );
        console.log('\n📝 Response:', response.output.content);

        // Record metrics
        defaultMetrics.increment('ai.requests.total', 1, {
          provider: 'openai',
          status: 'success',
        });
        defaultMetrics.histogram('ai.request.latency', latency, {
          provider: 'openai',
        });
      }
    } catch (error) {
      logger.error({ error, requestId }, 'OpenAI request failed');
      defaultMetrics.increment('ai.requests.total', 1, {
        provider: 'openai',
        status: 'error',
      });
    }
  }

  // 6. Streaming chat example
  if (anthropicKey) {
    logger.info('🌊 Testing Anthropic chat (streaming)...');
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      const stream = await anthropic.chat(
        {
          model: 'claude-3-5-haiku-20241022',
          input: [
            {
              role: 'user',
              content: 'Write a haiku about TypeScript.',
            },
          ],
          options: {
            stream: true,
            max_tokens: 200,
          },
        },
        anthropicKey
      );

      console.log('\n🎭 Streaming response:\n');

      // Stream handling
      let fullContent = '';
      let chunkCount = 0;

      if (Symbol.asyncIterator in stream) {
        for await (const chunk of stream) {
          if (chunk.delta.content) {
            fullContent += chunk.delta.content;
            process.stdout.write(chunk.delta.content);
            chunkCount++;
          }
        }
      }

      const latency = Date.now() - startTime;

      console.log('\n');
      logger.info(
        {
          requestId,
          latency,
          chunks: chunkCount,
          length: fullContent.length,
        },
        'Anthropic stream completed'
      );

      defaultMetrics.increment('ai.requests.total', 1, {
        provider: 'anthropic',
        status: 'success',
      });
      defaultMetrics.histogram('ai.request.latency', latency, {
        provider: 'anthropic',
      });
    } catch (error) {
      logger.error({ error, requestId }, 'Anthropic request failed');
      defaultMetrics.increment('ai.requests.total', 1, {
        provider: 'anthropic',
        status: 'error',
      });
    }
  }

  // 7. Embeddings example
  if (openaiKey) {
    logger.info('🔢 Testing OpenAI embeddings...');
    try {
      const response = await openai.embed(
        {
          model: 'text-embedding-3-small',
          input: ['Hello world', 'AI is transforming software'],
        },
        openaiKey
      );

      logger.info(
        {
          embeddings: response.embeddings.length,
          dimensions: response.embeddings[0]?.length,
        },
        'Embeddings generated'
      );
    } catch (error) {
      logger.error({ error }, 'Embeddings request failed');
    }
  }

  // 8. Display metrics summary
  console.log('\n📊 Metrics Summary:');
  const requestStats = defaultMetrics.getHistogramStats('ai.request.latency');
  if (requestStats) {
    console.log(`  Total requests: ${requestStats.count}`);
    console.log(`  Avg latency: ${Math.round(requestStats.mean)}ms`);
    console.log(`  P95 latency: ${Math.round(requestStats.p95)}ms`);
    console.log(`  Min latency: ${Math.round(requestStats.min)}ms`);
    console.log(`  Max latency: ${Math.round(requestStats.max)}ms`);
  }

  logger.info('✨ Example completed');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
