/**
 * Conversation storage utility
 *
 * Handles saving and loading conversation history to/from disk
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { Message } from '@aiu/core';

interface Conversation {
  messages: Message[];
  model?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class ConversationStorage {
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || join(homedir(), '.aiu', 'conversations');
    this.ensureDir();
  }

  private ensureDir() {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  save(filename: string, conversation: Conversation): void {
    const filepath = this.resolveFilepath(filename);
    const dir = dirname(filepath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filepath, JSON.stringify(conversation, null, 2), 'utf-8');
  }

  load(filename: string): Conversation {
    const filepath = this.resolveFilepath(filename);

    if (!existsSync(filepath)) {
      throw new Error(`Conversation not found: ${filename}`);
    }

    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  }

  list(): string[] {
    if (!existsSync(this.storageDir)) {
      return [];
    }

    return readdirSync(this.storageDir)
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // Most recent first
  }

  delete(filename: string): void {
    const filepath = this.resolveFilepath(filename);

    if (existsSync(filepath)) {
      unlinkSync(filepath);
    }
  }

  private resolveFilepath(filename: string): string {
    // If filename is absolute, use it directly
    if (filename.startsWith('/') || filename.match(/^[A-Z]:\\/)) {
      return filename;
    }

    // Add .json extension if missing
    if (!filename.endsWith('.json')) {
      filename += '.json';
    }

    return join(this.storageDir, filename);
  }

  exportToMarkdown(filename: string, conversation: Conversation): void {
    let markdown = `# Conversation - ${new Date(conversation.timestamp).toLocaleString()}\n\n`;

    if (conversation.model) {
      markdown += `**Model:** ${conversation.model}\n\n`;
    }

    markdown += `---\n\n`;

    for (const message of conversation.messages) {
      const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
      markdown += `## ${role}\n\n`;
      markdown += `${message.content}\n\n`;
    }

    const mdFilepath = this.resolveFilepath(filename).replace(/\.json$/, '.md');
    writeFileSync(mdFilepath, markdown, 'utf-8');
  }
}

// Fix missing import
import { unlinkSync } from 'fs';
