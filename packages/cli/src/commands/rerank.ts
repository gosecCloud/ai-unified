/**
 * CLI command for document reranking
 */

import { Command } from 'commander';
import { getAIU } from '../utils/init.js';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export const rerankCommand = new Command('rerank')
  .description('Rerank documents by relevance to a query')
  .argument('<query>', 'Search query')
  .argument('<documents...>', 'Documents to rerank (text or file paths)')
  .option('-m, --model <model>', 'Model to use (e.g., cohere:rerank-english-v3.0, jina:jina-reranker-v2)', 'cohere:rerank-english-v3.0')
  .option('-n, --top-n <n>', 'Number of top results to return')
  .option('--show-documents', 'Include document text in output', false)
  .option('-a, --alias <alias>', 'API key alias to use', 'default')
  .action(async (query: string, documents: string[], options: any) => {
    try {
      const aiu = await getAIU();

      // Parse documents (check if they're file paths)
      const parsedDocuments = documents.map((doc) => {
        try {
          // Try to read as file
          const content = readFileSync(resolve(doc), 'utf-8');
          return content;
        } catch {
          // Not a file, treat as text
          return doc;
        }
      });

      console.log(chalk.cyan('🔍 Reranking documents...'));
      console.log(chalk.gray(`Query: ${query}`));
      console.log(chalk.gray(`Model: ${options.model}`));
      console.log(chalk.gray(`Documents: ${parsedDocuments.length}`));
      if (options.topN) {
        console.log(chalk.gray(`Top N: ${options.topN}`));
      }
      console.log();

      const startTime = Date.now();

      const response = await aiu.rerank(
        {
          model: options.model,
          query,
          documents: parsedDocuments,
          options: {
            top_n: options.topN ? parseInt(options.topN) : undefined,
            return_documents: options.showDocuments,
          },
        },
        { keyAlias: options.alias }
      );

      const elapsed = Date.now() - startTime;

      console.log(chalk.green(`✓ Reranking completed in ${elapsed}ms`));
      console.log();

      console.log(chalk.blue(`Ranked Results (${response.results.length}):`));
      console.log(chalk.gray('─'.repeat(80)));

      for (let i = 0; i < response.results.length; i++) {
        const result = response.results[i];
        if (!result) continue;

        const score = (result.relevance_score * 100).toFixed(2);

        console.log();
        console.log(chalk.white(`${i + 1}. Relevance: ${chalk.green(score + '%')} ${chalk.gray(`(index: ${result.index})`)}`));

        if (options.showDocuments && result.document) {
          const docText = typeof result.document === 'string' ? result.document : result.document.text || '';
          const preview = docText.length > 200 ? docText.substring(0, 200) + '...' : docText;
          console.log(chalk.gray(`   ${preview.replace(/\n/g, ' ')}`));
        }
      }

      console.log();
      console.log(chalk.gray('─'.repeat(80)));
      console.log();

      if (response.usage?.totalTokens) {
        console.log(chalk.blue(`Total tokens: ${response.usage.totalTokens}`));
      }
    } catch (error) {
      console.error(chalk.red('✗ Error reranking documents:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
