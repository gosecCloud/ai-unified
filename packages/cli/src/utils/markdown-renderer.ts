/**
 * Markdown renderer for terminal
 *
 * Renders markdown content with syntax highlighting and formatting
 */

import chalk from 'chalk';

/**
 * Simple markdown renderer for terminal output
 *
 * Supports basic markdown: headers, bold, italic, code blocks, inline code, lists
 */
export function renderMarkdown(text: string): string {
  let result = text;

  // Code blocks (```language\ncode\n```)
  result = result.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, _lang, code) => {
    return chalk.gray('┌' + '─'.repeat(50) + '┐\n') +
           code.split('\n').map((line: string) => chalk.cyan('│ ') + chalk.white(line)).join('\n') +
           '\n' + chalk.gray('└' + '─'.repeat(50) + '┘');
  });

  // Inline code (`code`)
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    return chalk.bgGray.white(` ${code} `);
  });

  // Bold (**text** or __text__)
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));
  result = result.replace(/__([^_]+)__/g, (_, text) => chalk.bold(text));

  // Italic (*text* or _text_)
  result = result.replace(/\*([^*]+)\*/g, (_, text) => chalk.italic(text));
  result = result.replace(/_([^_]+)_/g, (_, text) => chalk.italic(text));

  // Headers (# Header)
  result = result.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
    const level = hashes.length;
    if (level === 1) return chalk.bold.cyan(`\n${text}\n${'='.repeat(text.length)}`);
    if (level === 2) return chalk.bold.blue(`\n${text}\n${'-'.repeat(text.length)}`);
    return chalk.bold.white(`\n${'#'.repeat(level)} ${text}`);
  });

  // Lists (- item or * item or 1. item)
  result = result.replace(/^(\s*)([-*]|\d+\.)\s+(.+)$/gm, (_, indent, marker, text) => {
    return `${indent}${chalk.yellow(marker)} ${text}`;
  });

  // Links ([text](url))
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    return chalk.blue.underline(text) + chalk.gray(` (${url})`);
  });

  return result;
}

/**
 * Strip markdown formatting for plain text output
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Remove code blocks
  result = result.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  result = result.replace(/`([^`]+)`/g, '$1');

  // Remove bold/italic
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  result = result.replace(/\*([^*]+)\*/g, '$1');
  result = result.replace(/_([^_]+)_/g, '$1');

  // Remove headers
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '$1');

  // Remove links
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  return result;
}
