/**
 * Interactive chat mode command
 *
 * Provides Claude Code / Gemini CLI-like interactive chat experience
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AIU, PersistentKeyring } from '@aiu/sdk';
import { ModelRegistry } from '@aiu/model-registry';
import { createLogger } from '@aiu/observability';
import { getPrismaClient, PrismaApiKeyRepository, PrismaModelRepository, PrismaRequestRepository } from '@aiu/storage';
import type { Message } from '@aiu/core';
import { loadConfig } from '../utils/config.js';
import { ConversationStorage } from '../utils/conversation-storage.js';

interface ChatSession {
  messages: Message[];
  model: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  startTime: Date;
}

export function createChatCommand(): Command {
  const cmd = new Command('chat');

  cmd
    .description('Start interactive chat mode')
    .option('-m, --model <model>', 'Model to use (e.g., openai:gpt-4o)')
    .option('-a, --alias <alias>', 'API key alias to use', 'default')
    .option('-s, --system <message>', 'System message')
    .option('--load <filename>', 'Load conversation from file')
    .option('--no-markdown', 'Disable markdown rendering')
    .action(async (options) => {
      await runInteractiveChat(options);
    });

  return cmd;
}

async function runInteractiveChat(options: any) {
  const config = await loadConfig();
  const logger = createLogger({ level: 'error', pretty: false }); // Quiet mode for chat
  const prisma = getPrismaClient();

  // Initialize components
  const masterKey = config.masterKey;
  const keyring = new PersistentKeyring({
    masterKey,
    repository: new PrismaApiKeyRepository(prisma),
    autoLoad: true,
  });

  const registry = new ModelRegistry({
    repository: new PrismaModelRepository(prisma),
  });

  const aiu = new AIU({
    keyring,
    registry,
    requestRepository: new PrismaRequestRepository(prisma),
    logger,
  });

  // Initialize session
  const session: ChatSession = {
    messages: [],
    model: options.model || 'openai:gpt-4o-mini',
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
    startTime: new Date(),
  };

  // Add system message if provided
  if (options.system) {
    session.messages.push({
      role: 'system',
      content: options.system,
    });
  }

  // Load conversation if specified
  const storage = new ConversationStorage();
  if (options.load) {
    try {
      const loaded = storage.load(options.load);
      session.messages = loaded.messages;
      session.model = loaded.model || session.model;
      console.log(chalk.green(`✓ Loaded conversation from ${options.load}`));
      console.log(chalk.gray(`  ${session.messages.length} messages loaded\n`));
    } catch (error: any) {
      console.error(chalk.red(`✗ Failed to load conversation: ${error.message}`));
      return;
    }
  }

  // Print welcome message
  printWelcome(session);

  // Main chat loop
  while (true) {
    try {
      // Get user input
      const { userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInput',
          message: chalk.blue('You:'),
          prefix: '',
        },
      ]);

      // Handle commands
      if (userInput.startsWith('/')) {
        const shouldContinue = await handleCommand(userInput.trim(), session, storage, aiu, options);
        if (!shouldContinue) break;
        continue;
      }

      // Skip empty input
      if (!userInput.trim()) continue;

      // Add user message to session
      session.messages.push({
        role: 'user',
        content: userInput.trim(),
      });

      // Send to AI
      const spinner = ora('Thinking...').start();

      try {
        const stream = await aiu.chat(
          {
            model: session.model,
            input: session.messages,
            options: { stream: true },
          },
          { keyAlias: options.alias }
        );

        spinner.stop();
        process.stdout.write(chalk.green('AI: '));

        let fullResponse = '';

        // Check if response is AsyncIterable (streaming)
        if (Symbol.asyncIterator in stream) {
          for await (const chunk of stream) {
            if (chunk.delta.content) {
              fullResponse += chunk.delta.content;
              if (options.markdown !== false) {
                // For now, just print raw (markdown rendering on completion)
                process.stdout.write(chunk.delta.content);
              } else {
                process.stdout.write(chunk.delta.content);
              }
            }
          }
        }

        process.stdout.write('\n\n');

        // Add assistant response to session
        session.messages.push({
          role: 'assistant',
          content: fullResponse,
        });
      } catch (error: any) {
        spinner.fail('Request failed');
        console.error(chalk.red(`Error: ${error.message}\n`));
      }
    } catch (error: any) {
      if (error.isTtyError) {
        console.error(chalk.red('Interactive mode not supported in this environment'));
        break;
      }
      throw error;
    }
  }
}

function printWelcome(session: ChatSession) {
  console.log(chalk.bold.cyan('\n🤖 AI Unified - Interactive Chat Mode\n'));
  console.log(chalk.gray('Model:'), chalk.white(session.model));
  console.log(chalk.gray('Commands:'));
  console.log(chalk.gray('  /help        - Show all commands'));
  console.log(chalk.gray('  /model       - Switch model'));
  console.log(chalk.gray('  /save        - Save conversation'));
  console.log(chalk.gray('  /clear       - Clear history'));
  console.log(chalk.gray('  /tokens      - Show token usage'));
  console.log(chalk.gray('  /cost        - Show running cost'));
  console.log(chalk.gray('  /exit, /quit - Exit chat\n'));
}

async function handleCommand(
  command: string,
  session: ChatSession,
  storage: ConversationStorage,
  _aiu: AIU,
  _options: any
): Promise<boolean> {
  const parts = command.split(' ');
  const cmd = parts[0]?.toLowerCase();

  switch (cmd) {
    case '/help':
      printHelp();
      return true;

    case '/model': {
      const newModel = parts.slice(1).join(' ').trim();
      if (newModel) {
        session.model = newModel;
        console.log(chalk.green(`✓ Switched to model: ${session.model}\n`));
      } else {
        console.log(chalk.yellow(`Current model: ${session.model}\n`));
      }
      return true;
    }

    case '/save': {
      const filename = parts.slice(1).join(' ').trim() || `chat-${Date.now()}.json`;
      try {
        storage.save(filename, {
          messages: session.messages,
          model: session.model,
          timestamp: new Date().toISOString(),
        });
        console.log(chalk.green(`✓ Conversation saved to ${filename}\n`));
      } catch (error: any) {
        console.error(chalk.red(`✗ Failed to save: ${error.message}\n`));
      }
      return true;
    }

    case '/load': {
      const filename = parts.slice(1).join(' ').trim();
      if (!filename) {
        console.log(chalk.yellow('Usage: /load <filename>\n'));
        return true;
      }
      try {
        const loaded = storage.load(filename);
        session.messages = loaded.messages;
        session.model = loaded.model || session.model;
        console.log(chalk.green(`✓ Loaded ${session.messages.length} messages from ${filename}\n`));
      } catch (error: any) {
        console.error(chalk.red(`✗ Failed to load: ${error.message}\n`));
      }
      return true;
    }

    case '/clear':
      // Keep system message if present
      const systemMsg = session.messages.find((m) => m.role === 'system');
      session.messages = systemMsg ? [systemMsg] : [];
      session.totalTokensIn = 0;
      session.totalTokensOut = 0;
      session.totalCost = 0;
      console.log(chalk.green('✓ Conversation history cleared\n'));
      return true;

    case '/tokens':
      console.log(chalk.cyan('\n📊 Token Usage:'));
      console.log(chalk.gray('  Input tokens:  '), chalk.white(session.totalTokensIn.toLocaleString()));
      console.log(chalk.gray('  Output tokens: '), chalk.white(session.totalTokensOut.toLocaleString()));
      console.log(chalk.gray('  Total tokens:  '), chalk.white((session.totalTokensIn + session.totalTokensOut).toLocaleString()));
      console.log();
      return true;

    case '/cost':
      console.log(chalk.cyan('\n💰 Cost:'));
      if (session.totalCost > 0) {
        console.log(chalk.gray('  Total: '), chalk.white(`$${session.totalCost.toFixed(6)}`));
      } else {
        console.log(chalk.gray('  Cost tracking not available for this model'));
      }
      console.log();
      return true;

    case '/stats': {
      const duration = Date.now() - session.startTime.getTime();
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);

      console.log(chalk.cyan('\n📈 Session Stats:'));
      console.log(chalk.gray('  Model:        '), chalk.white(session.model));
      console.log(chalk.gray('  Messages:     '), chalk.white(session.messages.length));
      console.log(chalk.gray('  Duration:     '), chalk.white(`${minutes}m ${seconds}s`));
      console.log(chalk.gray('  Tokens (in):  '), chalk.white(session.totalTokensIn.toLocaleString()));
      console.log(chalk.gray('  Tokens (out): '), chalk.white(session.totalTokensOut.toLocaleString()));
      if (session.totalCost > 0) {
        console.log(chalk.gray('  Cost:         '), chalk.white(`$${session.totalCost.toFixed(6)}`));
      }
      console.log();
      return true;
    }

    case '/exit':
    case '/quit':
      console.log(chalk.cyan('\n👋 Goodbye!\n'));
      return false;

    default:
      console.log(chalk.yellow(`Unknown command: ${cmd}`));
      console.log(chalk.gray('Type /help for available commands\n'));
      return true;
  }
}

function printHelp() {
  console.log(chalk.cyan('\n📖 Available Commands:\n'));
  console.log(chalk.white('  /help              '), chalk.gray('- Show this help message'));
  console.log(chalk.white('  /model [name]      '), chalk.gray('- Switch model or show current'));
  console.log(chalk.white('  /save [filename]   '), chalk.gray('- Save conversation to file'));
  console.log(chalk.white('  /load <filename>   '), chalk.gray('- Load conversation from file'));
  console.log(chalk.white('  /clear             '), chalk.gray('- Clear conversation history'));
  console.log(chalk.white('  /tokens            '), chalk.gray('- Show token usage'));
  console.log(chalk.white('  /cost              '), chalk.gray('- Show running cost'));
  console.log(chalk.white('  /stats             '), chalk.gray('- Show session statistics'));
  console.log(chalk.white('  /exit, /quit       '), chalk.gray('- Exit chat mode'));
  console.log();
}
