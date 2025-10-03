/**
 * aiu logs - View request logs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getPrismaClient, PrismaRequestRepository } from '@aiu/storage';

export const logsCommand = new Command('logs')
  .description('View request logs')
  .option('--tail <n>', 'Number of recent logs', parseInt, 10)
  .option('--provider <provider>', 'Filter by provider')
  .option('--status <status>', 'Filter by status')
  .action(async (options: { tail: number; provider?: string; status?: string }) => {
    const prisma = getPrismaClient();
    const requestRepo = new PrismaRequestRepository(prisma);

    const logs = await requestRepo.list({
      providerId: options.provider,
      status: options.status,
      limit: options.tail,
    });

    if (logs.length === 0) {
      console.log(chalk.yellow('No logs found'));
      return;
    }

    console.log(chalk.bold(`\n📋 Request Logs (${logs.length})\n`));

    for (const log of logs) {
      const statusColor = log.status === 'success' ? chalk.green : chalk.red;
      const timestamp = log.timestamp.toLocaleString();

      console.log(
        chalk.gray(`[${timestamp}]`) +
          ` ${chalk.blue(log.providerId)}:${log.modelId}` +
          ` ${statusColor(log.status)}` +
          chalk.gray(` (${log.latencyMs}ms)`)
      );

      if (log.tokensIn || log.tokensOut) {
        console.log(chalk.gray(`  Tokens: ${log.tokensIn ?? 0} in, ${log.tokensOut ?? 0} out`));
      }

      if (log.cost) {
        console.log(chalk.gray(`  Cost: $${log.cost.toFixed(4)}`));
      }

      if (log.errorMessage) {
        console.log(chalk.red(`  Error: ${log.errorMessage}`));
      }

      console.log();
    }
  });
