#!/usr/bin/env node
/**
 * AI Unified CLI
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { providerCommand } from './commands/provider.js';
import { modelsCommand } from './commands/models.js';
import { runCommand } from './commands/run.js';
import { logsCommand } from './commands/logs.js';
import { exportCommand } from './commands/export.js';
import { createChatCommand } from './commands/chat.js';
import { imageCommand } from './commands/image.js';
import { transcribeCommand } from './commands/transcribe.js';
import { speakCommand } from './commands/speak.js';
import { rerankCommand } from './commands/rerank.js';
import { agentCommand } from './commands/agent.js';

const program = new Command();

program
  .name('aiu')
  .description('AI Unified - Unified API for multiple AI providers')
  .version('0.1.0');

// Commands
program.addCommand(initCommand);
program.addCommand(providerCommand);
program.addCommand(agentCommand);
program.addCommand(modelsCommand);
program.addCommand(runCommand);
program.addCommand(logsCommand);
program.addCommand(exportCommand);
program.addCommand(createChatCommand());
program.addCommand(imageCommand);
program.addCommand(transcribeCommand);
program.addCommand(speakCommand);
program.addCommand(rerankCommand);

program.parse();
