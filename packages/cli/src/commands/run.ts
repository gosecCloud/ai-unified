/**
 * aiu run - Execute AI operations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getPrismaClient, PrismaApiKeyRepository, PrismaModelRepository, PrismaRequestRepository } from '@aiu/storage';
import { PersistentKeyring, AIU } from '@aiu/sdk';
import { ModelRegistry } from '@aiu/model-registry';
import { OpenAIAdapter } from '@aiu/provider-openai';
import { AnthropicAdapter } from '@aiu/provider-anthropic';
import { loadConfig } from '../utils/config.js';

export const runCommand = new Command('run').description('Run AI operations');

// aiu run chat
runCommand
  .command('chat')
  .description('Run a chat completion')
  .requiredOption('--model <model>', 'Model (format: provider:model)')
  .requiredOption('--input <input>', 'Input message')
  .option('--stream', 'Enable streaming', false)
  .option('--temperature <temp>', 'Temperature (0-2)', parseFloat, 0.7)
  .option('--alias <alias>', 'Key alias', 'default')
  .action(
    async (options: { model: string; input: string; stream: boolean; temperature: number; alias: string }) => {
      const config = await loadConfig();

      const prisma = getPrismaClient();
      const keyRepo = new PrismaApiKeyRepository(prisma);
      const modelRepo = new PrismaModelRepository(prisma);
      const requestRepo = new PrismaRequestRepository(prisma);

      const keyring = new PersistentKeyring({
        masterKey: config.masterKey,
        repository: keyRepo,
      });

      const registry = new ModelRegistry({ repository: modelRepo });
      registry.registerProvider(new OpenAIAdapter());
      registry.registerProvider(new AnthropicAdapter());

      const aiu = new AIU({
        keyring,
        registry,
        requestRepository: requestRepo,
      });

      console.log(chalk.blue(`\n🤖 Running chat with ${options.model}...\n`));

      try {
        const response = await aiu.chat(
          {
            model: options.model,
            input: [{ role: 'user', content: options.input }],
            options: {
              stream: options.stream,
              temperature: options.temperature,
            },
          },
          { keyAlias: options.alias }
        );

        if (options.stream && Symbol.asyncIterator in response) {
          // Streaming
          for await (const chunk of response) {
            if (chunk.delta.content) {
              process.stdout.write(chunk.delta.content);
            }
          }
          console.log('\n');
        } else if ('output' in response) {
          // Non-streaming
          console.log(chalk.green(response.output.content));
          console.log();
          if (response.usage) {
            console.log(
              chalk.gray(`Tokens: ${response.usage.promptTokens} in, ${response.usage.completionTokens} out`)
            );
          }
        }
      } catch (error) {
        console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
        process.exit(1);
      }
    }
  );
