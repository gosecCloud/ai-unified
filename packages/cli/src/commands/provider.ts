/**
 * aiu provider - Manage providers
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getPrismaClient, PrismaApiKeyRepository } from '@aiu/storage';
import { PersistentKeyring } from '@aiu/sdk';
import { OpenAIAdapter } from '@aiu/provider-openai';
import { AnthropicAdapter } from '@aiu/provider-anthropic';
import { loadConfig } from '../utils/config.js';

const providerAdapters = {
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
};

export const providerCommand = new Command('provider').description('Manage AI providers');

// aiu provider add
providerCommand
  .command('add')
  .description('Add a new provider API key')
  .argument('<provider>', 'Provider name (openai, anthropic)')
  .option('--key <key>', 'API key')
  .option('--alias <alias>', 'Key alias', 'default')
  .action(async (provider: string, options: { key?: string; alias: string }) => {
    const config = await loadConfig();

    if (!options.key) {
      console.error(chalk.red('❌ --key is required'));
      process.exit(1);
    }

    const prisma = getPrismaClient();
    const keyRepo = new PrismaApiKeyRepository(prisma);
    const keyring = new PersistentKeyring({
      masterKey: config.masterKey,
      repository: keyRepo,
      autoLoad: false,
    });

    const spinner = ora(`Adding ${provider} key...`).start();

    try {
      // Validate key
      const adapter = providerAdapters[provider as keyof typeof providerAdapters];
      if (!adapter) {
        spinner.fail(chalk.red(`Unknown provider: ${provider}`));
        process.exit(1);
      }

      const validation = await adapter.validateApiKey(options.key);
      if (!validation.valid) {
        spinner.fail(chalk.red(`Invalid API key: ${validation.reason}`));
        process.exit(1);
      }

      // Save key
      keyring.save({
        providerId: provider,
        alias: options.alias,
        key: options.key,
      });

      spinner.succeed(chalk.green(`✅ ${provider} key added (alias: ${options.alias})`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// aiu provider test
providerCommand
  .command('test')
  .description('Test provider API key')
  .argument('<provider>', 'Provider name')
  .option('--alias <alias>', 'Key alias', 'default')
  .action(async (provider: string, options: { alias: string }) => {
    const config = await loadConfig();

    const prisma = getPrismaClient();
    const keyRepo = new PrismaApiKeyRepository(prisma);
    const keyring = new PersistentKeyring({
      masterKey: config.masterKey,
      repository: keyRepo,
    });

    const spinner = ora(`Testing ${provider} connection...`).start();

    try {
      const adapter = providerAdapters[provider as keyof typeof providerAdapters];
      if (!adapter) {
        spinner.fail(chalk.red(`Unknown provider: ${provider}`));
        process.exit(1);
      }

      const apiKey = keyring.get(provider, options.alias);
      const validation = await adapter.validateApiKey(apiKey);

      if (validation.valid) {
        const models = await adapter.listModels(apiKey);
        spinner.succeed(chalk.green(`✅ ${provider} connected (${models.length} models available)`));
      } else {
        spinner.fail(chalk.red(`❌ Connection failed: ${validation.reason}`));
      }
    } catch (error) {
      spinner.fail(chalk.red(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// aiu provider list
providerCommand
  .command('list')
  .description('List configured providers')
  .action(async () => {
    const config = await loadConfig();

    const prisma = getPrismaClient();
    const keyRepo = new PrismaApiKeyRepository(prisma);
    const keyring = new PersistentKeyring({
      masterKey: config.masterKey,
      repository: keyRepo,
    });

    const keys = keyring.list();

    if (keys.length === 0) {
      console.log(chalk.yellow('No providers configured'));
      return;
    }

    console.log(chalk.bold('\n📋 Configured Providers\n'));
    for (const key of keys) {
      console.log(chalk.blue(`  ${key.providerId}`) + chalk.gray(` (${key.alias}) - ${key.status}`));
      if (key.lastValidatedAt) {
        console.log(chalk.gray(`    Last validated: ${key.lastValidatedAt.toLocaleString()}`));
      }
    }
    console.log();
  });
