/**
 * Configuration loader
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export interface Config {
  masterKey: Buffer;
  databaseUrl: string;
}

export async function loadConfig(): Promise<Config> {
  const envPath = path.join(process.cwd(), '.env');

  try {
    const envContent = await fs.readFile(envPath, 'utf-8');
    const env = parseEnv(envContent);

    if (!env.MASTER_KEY) {
      console.error(chalk.red('❌ MASTER_KEY not found in .env'));
      console.error(chalk.yellow('Run: aiu init'));
      process.exit(1);
    }

    if (!env.DATABASE_URL) {
      console.error(chalk.red('❌ DATABASE_URL not found in .env'));
      process.exit(1);
    }

    return {
      masterKey: Buffer.from(env.MASTER_KEY, 'base64'),
      databaseUrl: env.DATABASE_URL,
    };
  } catch (error) {
    console.error(chalk.red('❌ Failed to load .env file'));
    console.error(chalk.yellow('Run: aiu init'));
    process.exit(1);
  }
}

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  }
  return env;
}
