/**
 * CLI command for image generation
 */

import { Command } from 'commander';
import { getAIU } from '../utils/init.js';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

export const imageCommand = new Command('image')
  .description('Generate images from text prompts')
  .argument('<prompt>', 'Text prompt for image generation')
  .option('-m, --model <model>', 'Model to use (e.g., openai:dall-e-3, stability:stable-diffusion-xl)', 'openai:dall-e-3')
  .option('-n, --number <n>', 'Number of images to generate', '1')
  .option('-s, --size <size>', 'Image size (256x256, 512x512, 1024x1024, 1792x1024, 1024x1792)', '1024x1024')
  .option('-q, --quality <quality>', 'Image quality (standard, hd)', 'standard')
  .option('--style <style>', 'Image style (vivid, natural)', 'vivid')
  .option('-o, --output <path>', 'Output directory for images', './generated-images')
  .option('-a, --alias <alias>', 'API key alias to use', 'default')
  .action(async (prompt: string, options: any) => {
    try {
      const aiu = await getAIU();

      console.log(chalk.cyan(`🎨 Generating ${options.number} image(s)...`));
      console.log(chalk.gray(`Prompt: ${prompt}`));
      console.log(chalk.gray(`Model: ${options.model}`));
      console.log(chalk.gray(`Size: ${options.size}`));
      console.log();

      const startTime = Date.now();

      const response = await aiu.image(
        {
          model: options.model,
          input: prompt,
          options: {
            n: parseInt(options.number),
            size: options.size,
            quality: options.quality,
            style: options.style,
          },
        },
        { keyAlias: options.alias }
      );

      const elapsed = Date.now() - startTime;

      console.log(chalk.green(`✓ Generated ${response.images.length} image(s) in ${elapsed}ms`));
      console.log();

      // Save images
      const outputDir = resolve(options.output);
      const timestamp = Date.now();

      for (let i = 0; i < response.images.length; i++) {
        const image = response.images[i];
        if (!image) continue;

        let outputPath: string;

        if (image.url) {
          console.log(chalk.blue(`📷 Image ${i + 1}: ${image.url}`));

          // Download and save
          const imageResponse = await fetch(image.url);
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          outputPath = `${outputDir}/image-${timestamp}-${i + 1}.png`;
          writeFileSync(outputPath, imageBuffer);
          console.log(chalk.gray(`   Saved to: ${outputPath}`));
        } else if (image.b64_json) {
          const imageBuffer = Buffer.from(image.b64_json, 'base64');
          outputPath = `${outputDir}/image-${timestamp}-${i + 1}.png`;
          writeFileSync(outputPath, imageBuffer);
          console.log(chalk.blue(`📷 Image ${i + 1}: ${outputPath}`));
        }

        if (image.revised_prompt) {
          console.log(chalk.gray(`   Revised prompt: ${image.revised_prompt}`));
        }
        console.log();
      }

      console.log(chalk.green(`✓ All images saved to ${outputDir}`));
    } catch (error) {
      console.error(chalk.red('✗ Error generating images:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
