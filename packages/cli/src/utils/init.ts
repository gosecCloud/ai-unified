/**
 * Initialize AIU SDK for CLI commands
 */

import { AIU } from '@aiu/sdk';
import { PersistentKeyring } from '@aiu/sdk';
import { PrismaApiKeyRepository, PrismaModelRepository, getPrismaClient } from '@aiu/storage';
import { ModelRegistry } from '@aiu/model-registry';
import { loadConfig } from './config.js';

let aiuInstance: AIU | null = null;

/**
 * Get or create AIU instance with CLI configuration
 */
export async function getAIU(): Promise<AIU> {
  if (aiuInstance) {
    return aiuInstance;
  }

  const config = await loadConfig();
  const prisma = getPrismaClient();
  const keyRepo = new PrismaApiKeyRepository(prisma);
  const keyring = new PersistentKeyring({
    masterKey: config.masterKey,
    repository: keyRepo,
  });

  const registry = new ModelRegistry({
    repository: new PrismaModelRepository(prisma),
  });

  aiuInstance = new AIU({ keyring, registry });
  return aiuInstance;
}
