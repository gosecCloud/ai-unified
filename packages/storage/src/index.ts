/**
 * @aiu/storage - Database storage layer
 */

export { getPrismaClient, disconnectPrisma } from './client.js';

export {
  PrismaProviderRepository,
  PrismaApiKeyRepository,
  PrismaModelRepository,
  PrismaRequestRepository,
  PrismaWorkspaceRepository,
  PrismaAgentRepository,
  PrismaJobRepository,
  PrismaRunRepository,
  PrismaArtifactRepository,
  PrismaAgentEventRepository,
  type ProviderRepository,
  type ApiKeyRepository,
  type ModelRepository,
  type RequestRepository,
  type WorkspaceRepository,
  type AgentRepository,
  type JobRepository,
  type RunRepository,
  type ArtifactRepository,
  type AgentEventRepository,
} from './repositories.js';

// Re-export Prisma types for convenience
export type { PrismaClient } from '@prisma/client';
