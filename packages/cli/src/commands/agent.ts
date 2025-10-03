/**
 * aiu agent - Manage autonomous coding agents
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ClaudeCodeAdapter, GeminiCliAdapter, CodexAdapter } from '@aiu/agents';
import type { AgentAdapter, AgentJob } from '@aiu/core';
import { createLogger } from '@aiu/observability';

const logger = createLogger({ level: 'info' });

const agentAdapters: Record<string, AgentAdapter> = {
  'claude-code': new ClaudeCodeAdapter(logger),
  'gemini-cli': new GeminiCliAdapter(logger),
  'codex': new CodexAdapter(logger),
};

export const agentCommand = new Command('agent').description('Manage autonomous coding agents');

// aiu agent detect
agentCommand
  .command('detect')
  .description('Detect installed coding agents')
  .option('--agent <agent>', 'Specific agent to detect (claude-code, gemini-cli, codex)')
  .action(async (options: { agent?: string }) => {
    const agentsToCheck = options.agent
      ? [options.agent]
      : Object.keys(agentAdapters);

    console.log(chalk.bold('\n🔍 Detecting Coding Agents\n'));

    for (const agentId of agentsToCheck) {
      const adapter = agentAdapters[agentId];
      if (!adapter) {
        console.log(chalk.red(`  ❌ Unknown agent: ${agentId}`));
        continue;
      }

      const spinner = ora(`Checking ${agentId}...`).start();

      try {
        const result = await adapter.detect();

        if (result.installed) {
          spinner.succeed(
            chalk.green(`${agentId}`) +
            (result.version ? chalk.gray(` v${result.version}`) : '') +
            (result.path ? chalk.gray(` (${result.path})`) : '')
          );
        } else {
          spinner.fail(chalk.gray(`${agentId} not installed`));
        }
      } catch (error) {
        spinner.fail(chalk.red(`${agentId} detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }

    console.log();
  });

// aiu agent auth
agentCommand
  .command('auth')
  .description('Validate agent authentication')
  .argument('<agent>', 'Agent to authenticate (claude-code, gemini-cli, codex)')
  .action(async (agentId: string) => {
    const adapter = agentAdapters[agentId];
    if (!adapter) {
      console.error(chalk.red(`❌ Unknown agent: ${agentId}`));
      process.exit(1);
    }

    const info = adapter.info();
    const spinner = ora(`Validating ${agentId} authentication...`).start();

    try {
      // Check required environment variables
      if (info.requiredEnv && info.requiredEnv.length > 0) {
        const missingEnv = info.requiredEnv.filter(env => !process.env[env]);
        if (missingEnv.length > 0) {
          spinner.fail(chalk.red(`Missing required environment variables: ${missingEnv.join(', ')}`));
          process.exit(1);
        }
      }

      const result = await adapter.validateAuth();

      if (result.valid) {
        spinner.succeed(chalk.green(`✅ ${agentId} authentication valid`));
      } else {
        spinner.fail(chalk.red(`❌ Authentication failed: ${result.reason || 'Unknown reason'}`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// aiu agent run
agentCommand
  .command('run')
  .description('Run a coding task with an agent')
  .argument('<agent>', 'Agent to use (claude-code, gemini-cli, codex)')
  .argument('<task>', 'Task description')
  .option('--workspace <path>', 'Workspace directory', process.cwd())
  .option('--file <files...>', 'Context files to include')
  .option('--timeout <ms>', 'Timeout in milliseconds', '300000')
  .option('--no-network', 'Disable network access')
  .option('--no-shell', 'Disable shell commands')
  .action(async (
    agentId: string,
    task: string,
    options: {
      workspace: string;
      file?: string[];
      timeout: string;
      network: boolean;
      shell: boolean;
    }
  ) => {
    const adapter = agentAdapters[agentId];
    if (!adapter) {
      console.error(chalk.red(`❌ Unknown agent: ${agentId}`));
      process.exit(1);
    }

    console.log(chalk.bold(`\n🤖 Running ${agentId}\n`));
    console.log(chalk.gray(`Task: ${task}`));
    console.log(chalk.gray(`Workspace: ${options.workspace}`));
    if (options.file) {
      console.log(chalk.gray(`Context files: ${options.file.join(', ')}`));
    }
    console.log();

    const spinner = ora('Starting agent...').start();

    const job: AgentJob = {
      id: `job-${Date.now()}`,
      agentId,
      task,
      workspaceId: options.workspace,
      contextFiles: options.file,
      profile: {
        name: 'cli-run',
        allowNetwork: options.network,
        allowShell: options.shell,
        timeoutMs: parseInt(options.timeout, 10),
      },
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      let eventCount = 0;

      for await (const event of adapter.execute(job)) {
        eventCount++;

        switch (event.type) {
          case 'task_start':
            spinner.succeed(chalk.green('Agent started'));
            break;

          case 'tool_use':
            console.log(chalk.blue(`  🔧 ${event.data.tool}`));
            break;

          case 'file_edit':
            console.log(chalk.yellow(`  📝 Edited: ${event.data.path}`));
            break;

          case 'file_create':
            console.log(chalk.green(`  ✨ Created: ${event.data.path}`));
            break;

          case 'shell_exec':
            console.log(chalk.cyan(`  💻 Shell: ${event.data.command}`));
            break;

          case 'thinking':
            console.log(chalk.gray(`  💭 ${event.data.content}`));
            break;

          case 'error':
            console.log(chalk.red(`  ❌ Error: ${event.data.error}`));
            break;

          case 'task_complete':
            console.log(chalk.green(`\n✅ Task completed in ${event.data.durationMs}ms`));
            console.log(chalk.gray(`Events: ${eventCount}`));
            break;

          default:
            // Log other events at debug level
            logger.debug({ event }, 'Agent event');
        }
      }

      console.log();
    } catch (error) {
      spinner.fail(chalk.red(`Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// aiu agent cancel
agentCommand
  .command('cancel')
  .description('Cancel a running agent job')
  .argument('<runId>', 'Run ID to cancel')
  .action(async (runId: string) => {
    console.error(chalk.yellow('⚠️  Agent cancellation not yet implemented'));
    console.log(chalk.gray(`Run ID: ${runId}`));
    console.log(chalk.gray('\nNote: Currently agent jobs can only be cancelled via SIGINT (Ctrl+C)'));
    process.exit(1);
  });

// aiu agent status
agentCommand
  .command('status')
  .description('Get status of a running agent job')
  .argument('<runId>', 'Run ID to check')
  .action(async (runId: string) => {
    console.error(chalk.yellow('⚠️  Agent status checking not yet implemented'));
    console.log(chalk.gray(`Run ID: ${runId}`));
    console.log(chalk.gray('\nNote: Status tracking requires persistence layer to be implemented'));
    process.exit(1);
  });

// aiu agent list
agentCommand
  .command('list')
  .description('List available coding agents')
  .action(async () => {
    console.log(chalk.bold('\n🤖 Available Coding Agents\n'));

    for (const [agentId, adapter] of Object.entries(agentAdapters)) {
      const info = adapter.info();
      console.log(chalk.blue(`  ${info.name}`) + chalk.gray(` (${agentId})`));
      console.log(chalk.gray(`    Version: ${info.version}`));
      console.log(chalk.gray(`    Binary: ${info.binaryPath}`));
      console.log(chalk.gray(`    Capabilities: ${info.capabilities.join(', ')}`));
      if (info.requiredEnv && info.requiredEnv.length > 0) {
        console.log(chalk.gray(`    Required env: ${info.requiredEnv.join(', ')}`));
      }
      console.log();
    }
  });
