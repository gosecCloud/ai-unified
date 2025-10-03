/**
 * aiu init - Initialize AI Unified configuration
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { Keyring } from '@aiu/keyring';

export const initCommand = new Command('init')
  .description('Initialize AI Unified configuration')
  .action(async () => {
    console.log(chalk.bold.blue('\n🤖 AI Unified - Initialization\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'database',
        message: 'Select database:',
        choices: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server'],
        default: 'SQLite',
      },
      {
        type: 'input',
        name: 'dbUrl',
        message: 'Database connection URL:',
        default: (answers: any) =>
          answers.database === 'SQLite' ? 'file:./aiu.db' : 'postgresql://localhost:5432/ai_unified',
        when: (answers) => answers.database !== 'SQLite',
      },
      {
        type: 'confirm',
        name: 'generateKey',
        message: 'Generate new master encryption key?',
        default: true,
      },
    ]);

    // Generate master key
    let masterKey: Buffer;
    if (answers.generateKey) {
      masterKey = Keyring.generateMasterKey();
      console.log(chalk.green('\n✅ Master key generated'));
      console.log(chalk.yellow('⚠️  Store this key securely (KMS/vault in production):'));
      console.log(chalk.gray(masterKey.toString('base64')));
    }

    // Create .env file
    const envPath = path.join(process.cwd(), '.env');
    const dbUrl = answers.database === 'SQLite' ? 'file:./aiu.db' : answers.dbUrl;

    const envContent = `# AI Unified Configuration
DATABASE_URL="${dbUrl}"
MASTER_KEY="${answers.generateKey ? masterKey!.toString('base64') : ''}"

# Provider API Keys (optional - use keyring instead)
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
`;

    await fs.writeFile(envPath, envContent);
    console.log(chalk.green(`\n✅ Configuration written to ${envPath}`));

    console.log(chalk.bold('\nNext steps:'));
    console.log(chalk.gray('1. Run migrations: cd packages/storage && pnpm db:push'));
    console.log(chalk.gray('2. Add provider: aiu provider add openai --key sk-...'));
    console.log(chalk.gray('3. List models: aiu models list'));
    console.log(chalk.gray('4. Run chat: aiu run chat --model openai:gpt-4o-mini --input "Hello"\n'));
  });
