/**
 * aiu models - List available models
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getPrismaClient, PrismaApiKeyRepository, PrismaModelRepository } from '@aiu/storage';
import { PersistentKeyring } from '@aiu/sdk';
import { ModelRegistry } from '@aiu/model-registry';
import { OpenAIAdapter } from '@aiu/provider-openai';
import { AnthropicAdapter } from '@aiu/provider-anthropic';
import { loadConfig } from '../utils/config.js';

export const modelsCommand = new Command('models')
  .description('List available AI models')
  .option('--provider <provider>', 'Filter by provider')
  .option('--kind <kind>', 'Filter by model kind (chat, embed, etc.)')
  .option('--refresh', 'Refresh models from API')
  .action(async (options: { provider?: string; kind?: string; refresh?: boolean }) => {
    const config = await loadConfig();

    const prisma = getPrismaClient();
    const keyRepo = new PrismaApiKeyRepository(prisma);
    const modelRepo = new PrismaModelRepository(prisma);

    const keyring = new PersistentKeyring({
      masterKey: config.masterKey,
      repository: keyRepo,
    });

    const registry = new ModelRegistry({ repository: modelRepo });
    registry.registerProvider(new OpenAIAdapter());
    registry.registerProvider(new AnthropicAdapter());

    // Refresh if requested
    if (options.refresh) {
      console.log(chalk.blue('🔄 Refreshing models from providers...\n'));
      const keys = keyring.list();
      for (const key of keys) {
        if (key.status === 'active') {
          try {
            const apiKey = keyring.get(key.providerId, key.alias);
            await registry.refresh(key.providerId, apiKey);
            console.log(chalk.green(`✅ ${key.providerId} refreshed`));
          } catch (error) {
            console.log(chalk.red(`❌ ${key.providerId} failed: ${error instanceof Error ? error.message : 'Unknown'}`));
          }
        }
      }
      console.log();
    }

    // Get models
    const models = await registry.find({
      providerId: options.provider,
      kind: options.kind,
      excludeDeprecated: true,
    });

    if (models.length === 0) {
      console.log(chalk.yellow('No models found'));
      return;
    }

    console.log(chalk.bold(`\n📋 Available Models (${models.length})\n`));

    // Group by provider
    const byProvider = models.reduce(
      (acc, model) => {
        if (!acc[model.providerId]) acc[model.providerId] = [];
        acc[model.providerId]!.push(model);
        return acc;
      },
      {} as Record<string, typeof models>
    );

    for (const [providerId, providerModels] of Object.entries(byProvider)) {
      console.log(chalk.blue.bold(`\n  ${providerId}`));
      for (const model of providerModels) {
        const context = model.contextWindow ? ` (${Math.floor(model.contextWindow / 1000)}k context)` : '';
        console.log(chalk.gray(`    • ${model.modelId}`) + chalk.dim(` [${model.kind}]${context}`));
      }
    }
    console.log();
  });
