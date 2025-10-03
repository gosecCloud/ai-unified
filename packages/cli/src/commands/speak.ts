/**
 * CLI command for text-to-speech
 */

import { Command } from 'commander';
import { getAIU } from '../utils/init.js';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

export const speakCommand = new Command('speak')
  .description('Convert text to speech')
  .argument('<text>', 'Text to convert to speech')
  .option('-m, --model <model>', 'Model to use (e.g., openai:tts-1, elevenlabs:eleven_turbo_v2)', 'openai:tts-1')
  .option('-v, --voice <voice>', 'Voice to use (e.g., alloy, echo, nova for OpenAI)', 'alloy')
  .option('-s, --speed <speed>', 'Speech speed (0.25 to 4.0)', '1.0')
  .option('-f, --format <format>', 'Audio format (mp3, opus, aac, flac, wav)', 'mp3')
  .option('-o, --output <path>', 'Output file path', './speech-output.mp3')
  .option('-a, --alias <alias>', 'API key alias to use', 'default')
  .action(async (text: string, options: any) => {
    try {
      const aiu = await getAIU();

      console.log(chalk.cyan('🔊 Generating speech...'));
      console.log(chalk.gray(`Text: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`));
      console.log(chalk.gray(`Model: ${options.model}`));
      console.log(chalk.gray(`Voice: ${options.voice}`));
      console.log(chalk.gray(`Speed: ${options.speed}x`));
      console.log();

      const startTime = Date.now();

      const response = await aiu.speak(
        {
          model: options.model,
          input: text,
          options: {
            voice: options.voice,
            speed: parseFloat(options.speed),
            response_format: options.format,
          },
        },
        { keyAlias: options.alias }
      );

      const elapsed = Date.now() - startTime;

      console.log(chalk.green(`✓ Speech generated in ${elapsed}ms`));
      console.log();

      // Save audio
      const outputPath = resolve(options.output);
      const audioBuffer = Buffer.isBuffer(response.audio) ? response.audio : Buffer.from(response.audio as string);

      writeFileSync(outputPath, audioBuffer);

      console.log(chalk.blue(`🎵 Audio saved to: ${outputPath}`));
      console.log(chalk.gray(`   Format: ${response.format}`));
      console.log(chalk.gray(`   Size: ${(audioBuffer.length / 1024).toFixed(2)} KB`));
      console.log();
      console.log(chalk.green('✓ Done!'));
    } catch (error) {
      console.error(chalk.red('✗ Error generating speech:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
