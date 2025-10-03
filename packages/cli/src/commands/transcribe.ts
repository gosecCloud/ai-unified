/**
 * CLI command for audio transcription
 */

import { Command } from 'commander';
import { getAIU } from '../utils/init.js';
import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export const transcribeCommand = new Command('transcribe')
  .description('Transcribe audio to text')
  .argument('<audio>', 'Path to audio file or URL')
  .option('-m, --model <model>', 'Model to use (e.g., openai:whisper-1, assemblyai:best)', 'openai:whisper-1')
  .option('-l, --language <language>', 'Language code (e.g., en, es, fr)')
  .option('-f, --format <format>', 'Output format (json, text, srt, vtt)', 'text')
  .option('-o, --output <path>', 'Output file path')
  .option('-a, --alias <alias>', 'API key alias to use', 'default')
  .action(async (audio: string, options: any) => {
    try {
      const aiu = await getAIU();

      console.log(chalk.cyan('🎤 Transcribing audio...'));
      console.log(chalk.gray(`Input: ${audio}`));
      console.log(chalk.gray(`Model: ${options.model}`));
      if (options.language) {
        console.log(chalk.gray(`Language: ${options.language}`));
      }
      console.log();

      const startTime = Date.now();

      // Determine input type
      let input: string | Buffer | { url: string };
      if (audio.startsWith('http://') || audio.startsWith('https://')) {
        input = { url: audio };
      } else {
        // Read local file
        const audioBuffer = readFileSync(resolve(audio));
        input = audioBuffer;
      }

      const response = await aiu.transcribe(
        {
          model: options.model,
          input,
          options: {
            language: options.language,
            response_format: options.format,
          },
        },
        { keyAlias: options.alias }
      );

      const elapsed = Date.now() - startTime;

      console.log(chalk.green(`✓ Transcription completed in ${elapsed}ms`));
      console.log();

      if (response.language) {
        console.log(chalk.blue(`Language: ${response.language}`));
      }
      if (response.duration) {
        console.log(chalk.blue(`Duration: ${response.duration.toFixed(2)}s`));
      }
      console.log();

      // Output text
      if (options.format === 'text') {
        console.log(chalk.white('Transcription:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(response.text);
        console.log(chalk.gray('─'.repeat(50)));
      } else {
        console.log(chalk.white('Transcription (JSON):'));
        console.log(JSON.stringify(response, null, 2));
      }

      // Save to file if specified
      if (options.output) {
        const outputPath = resolve(options.output);
        const content = options.format === 'json' ? JSON.stringify(response, null, 2) : response.text;
        writeFileSync(outputPath, content, 'utf-8');
        console.log();
        console.log(chalk.green(`✓ Saved to ${outputPath}`));
      }

      // Show segments if available
      if (response.segments && response.segments.length > 0) {
        console.log();
        console.log(chalk.blue(`Segments (${response.segments.length}):`));
        for (const segment of response.segments.slice(0, 5)) {
          const start = segment.start.toFixed(2);
          const end = segment.end.toFixed(2);
          console.log(chalk.gray(`  [${start}s - ${end}s] ${segment.text}`));
        }
        if (response.segments.length > 5) {
          console.log(chalk.gray(`  ... and ${response.segments.length - 5} more segments`));
        }
      }
    } catch (error) {
      console.error(chalk.red('✗ Error transcribing audio:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
