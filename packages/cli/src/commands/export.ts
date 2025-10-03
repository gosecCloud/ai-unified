/**
 * aiu export - Export usage data
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getPrismaClient, PrismaRequestRepository } from '@aiu/storage';

export const exportCommand = new Command('export')
  .description('Export usage statistics')
  .option('--from <date>', 'Start date (YYYY-MM-DD)')
  .option('--to <date>', 'End date (YYYY-MM-DD)')
  .option('--provider <provider>', 'Filter by provider')
  .option('--format <format>', 'Output format (json, csv)', 'json')
  .action(async (options: { from?: string; to?: string; provider?: string; format: string }) => {
    const prisma = getPrismaClient();
    const requestRepo = new PrismaRequestRepository(prisma);

    const stats = await requestRepo.getStats({
      providerId: options.provider,
      from: options.from ? new Date(options.from) : undefined,
      to: options.to ? new Date(options.to) : undefined,
    });

    if (options.format === 'json') {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log(chalk.bold('\n📊 Usage Statistics\n'));
      console.log(chalk.gray(`Total Requests: ${stats.count}`));
      console.log(chalk.gray(`Avg Latency: ${Math.round(stats.avgLatencyMs)}ms`));
      console.log(chalk.gray(`Total Tokens In: ${stats.totalTokensIn}`));
      console.log(chalk.gray(`Total Tokens Out: ${stats.totalTokensOut}`));
      console.log(chalk.gray(`Total Cost: $${stats.totalCost.toFixed(2)}`));
      console.log();
    }
  });
