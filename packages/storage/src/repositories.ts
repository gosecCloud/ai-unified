/**
 * Repository interfaces and implementations
 */

import type { PrismaClient } from '@prisma/client';
import type {
  ApiKeyInfo,
  ModelInfo,
  RequestLog,
  WorkspacePolicy,
  AgentCapability,
  AgentJob,
  AgentRunResult,
  Artifact,
  AgentEvent,
} from '@aiu/core';
import { storageError } from '@aiu/core';

export interface ProviderRepository {
  create(id: string, name: string): Promise<void>;
  findById(id: string): Promise<{ id: string; name: string } | null>;
  list(): Promise<{ id: string; name: string }[]>;
  delete(id: string): Promise<void>;
}

export interface ApiKeyRepository {
  save(key: Omit<ApiKeyInfo, 'id'> & { id?: string }): Promise<ApiKeyInfo>;
  findById(id: string): Promise<ApiKeyInfo | null>;
  findByAlias(providerId: string, alias: string): Promise<ApiKeyInfo | null>;
  list(providerId?: string): Promise<ApiKeyInfo[]>;
  updateStatus(id: string, status: ApiKeyInfo['status']): Promise<void>;
  markValidated(id: string, scopes?: string[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ModelRepository {
  saveMany(models: ModelInfo[]): Promise<void>;
  findByProviderAndModel(providerId: string, modelId: string): Promise<ModelInfo | null>;
  list(providerId?: string, kind?: string): Promise<ModelInfo[]>;
  deleteByProvider(providerId: string): Promise<void>;
}

export interface RequestRepository {
  save(log: Omit<RequestLog, 'id'>): Promise<RequestLog>;
  findById(id: string): Promise<RequestLog | null>;
  list(options?: {
    providerId?: string;
    modelId?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<RequestLog[]>;
  getStats(options?: {
    providerId?: string;
    from?: Date;
    to?: Date;
  }): Promise<{
    count: number;
    avgLatencyMs: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
  }>;
}

/**
 * Prisma-based repository implementations
 */
export class PrismaProviderRepository implements ProviderRepository {
  constructor(private prisma: PrismaClient) {}

  async create(id: string, name: string): Promise<void> {
    try {
      await this.prisma.provider.create({
        data: { id, name },
      });
    } catch (error) {
      throw storageError('Failed to create provider', error as Error);
    }
  }

  async findById(id: string) {
    return this.prisma.provider.findUnique({ where: { id } });
  }

  async list() {
    return this.prisma.provider.findMany({
      select: { id: true, name: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.provider.delete({ where: { id } });
  }
}

export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private prisma: PrismaClient) {}

  async save(key: Omit<ApiKeyInfo, 'id'> & { id?: string }): Promise<ApiKeyInfo> {
    try {
      const data = {
        providerId: key.providerId,
        alias: key.alias,
        keyCiphertext: key.keyCiphertext,
        status: key.status,
        scopes: key.scopes ?? [],
        lastValidatedAt: key.lastValidatedAt,
        metadata: key.metadata as any,
      };

      const result = key.id
        ? await this.prisma.apiKey.update({
            where: { id: key.id },
            data,
          })
        : await this.prisma.apiKey.create({ data });

      return this.toApiKeyInfo(result);
    } catch (error) {
      throw storageError('Failed to save API key', error as Error);
    }
  }

  async findById(id: string): Promise<ApiKeyInfo | null> {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    return key ? this.toApiKeyInfo(key) : null;
  }

  async findByAlias(providerId: string, alias: string): Promise<ApiKeyInfo | null> {
    const key = await this.prisma.apiKey.findUnique({
      where: { providerId_alias: { providerId, alias } },
    });
    return key ? this.toApiKeyInfo(key) : null;
  }

  async list(providerId?: string): Promise<ApiKeyInfo[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: providerId ? { providerId } : undefined,
    });
    return keys.map((k: any) => this.toApiKeyInfo(k));
  }

  async updateStatus(id: string, status: ApiKeyInfo['status']): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { status },
    });
  }

  async markValidated(id: string, scopes?: string[]): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        lastValidatedAt: new Date(),
        ...(scopes && { scopes }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.apiKey.delete({ where: { id } });
  }

  private toApiKeyInfo(key: any): ApiKeyInfo {
    return {
      id: key.id,
      providerId: key.providerId,
      alias: key.alias,
      keyCiphertext: key.keyCiphertext,
      status: key.status as ApiKeyInfo['status'],
      scopes: key.scopes,
      createdAt: key.createdAt,
      lastValidatedAt: key.lastValidatedAt ?? undefined,
      metadata: key.metadata as Record<string, unknown> | undefined,
    };
  }
}

export class PrismaModelRepository implements ModelRepository {
  constructor(private prisma: PrismaClient) {}

  async saveMany(models: ModelInfo[]): Promise<void> {
    try {
      for (const model of models) {
        await this.prisma.model.upsert({
          where: {
            providerId_modelId: {
              providerId: model.providerId,
              modelId: model.modelId,
            },
          },
          create: {
            providerId: model.providerId,
            modelId: model.modelId,
            kind: model.kind,
            contextWindow: model.contextWindow,
            maxOutputTokens: model.maxOutputTokens,
            modalities: model.modalities ?? [],
            deprecated: model.deprecated ?? false,
            costPerInputToken: model.costPerInputToken,
            costPerOutputToken: model.costPerOutputToken,
            metadata: model.metadata as any,
          },
          update: {
            kind: model.kind,
            contextWindow: model.contextWindow,
            maxOutputTokens: model.maxOutputTokens,
            modalities: model.modalities ?? [],
            deprecated: model.deprecated ?? false,
            costPerInputToken: model.costPerInputToken,
            costPerOutputToken: model.costPerOutputToken,
            metadata: model.metadata as any,
            cachedAt: new Date(),
          },
        });
      }
    } catch (error) {
      throw storageError('Failed to save models', error as Error);
    }
  }

  async findByProviderAndModel(providerId: string, modelId: string): Promise<ModelInfo | null> {
    const model = await this.prisma.model.findUnique({
      where: { providerId_modelId: { providerId, modelId } },
    });
    return model ? this.toModelInfo(model) : null;
  }

  async list(providerId?: string, kind?: string): Promise<ModelInfo[]> {
    const models = await this.prisma.model.findMany({
      where: {
        ...(providerId && { providerId }),
        ...(kind && { kind }),
      },
    });
    return models.map((m: any) => this.toModelInfo(m));
  }

  async deleteByProvider(providerId: string): Promise<void> {
    await this.prisma.model.deleteMany({ where: { providerId } });
  }

  private toModelInfo(model: any): ModelInfo {
    return {
      providerId: model.providerId,
      modelId: model.modelId,
      kind: model.kind,
      contextWindow: model.contextWindow ?? undefined,
      maxOutputTokens: model.maxOutputTokens ?? undefined,
      modalities: model.modalities as ModelInfo['modalities'],
      deprecated: model.deprecated,
      costPerInputToken: model.costPerInputToken ?? undefined,
      costPerOutputToken: model.costPerOutputToken ?? undefined,
      metadata: model.metadata as Record<string, unknown> | undefined,
    };
  }
}

export class PrismaRequestRepository implements RequestRepository {
  constructor(private prisma: PrismaClient) {}

  async save(log: Omit<RequestLog, 'id'>): Promise<RequestLog> {
    try {
      const result = await this.prisma.request.create({
        data: {
          timestamp: log.timestamp,
          providerId: log.providerId,
          modelId: log.modelId,
          latencyMs: log.latencyMs,
          tokensIn: log.tokensIn,
          tokensOut: log.tokensOut,
          cost: log.cost,
          status: log.status,
          errorMessage: log.errorMessage,
          metadata: log.metadata as any,
        },
      });
      return this.toRequestLog(result);
    } catch (error) {
      throw storageError('Failed to save request log', error as Error);
    }
  }

  async findById(id: string): Promise<RequestLog | null> {
    const log = await this.prisma.request.findUnique({ where: { id } });
    return log ? this.toRequestLog(log) : null;
  }

  async list(options?: {
    providerId?: string;
    modelId?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<RequestLog[]> {
    const logs = await this.prisma.request.findMany({
      where: {
        ...(options?.providerId && { providerId: options.providerId }),
        ...(options?.modelId && { modelId: options.modelId }),
        ...(options?.status && { status: options.status }),
        ...(options?.from && { timestamp: { gte: options.from } }),
        ...(options?.to && { timestamp: { lte: options.to } }),
      },
      take: options?.limit ?? 100,
      orderBy: { timestamp: 'desc' },
    });
    return logs.map((l: any) => this.toRequestLog(l));
  }

  async getStats(options?: {
    providerId?: string;
    from?: Date;
    to?: Date;
  }) {
    const result = await this.prisma.request.aggregate({
      where: {
        ...(options?.providerId && { providerId: options.providerId }),
        ...(options?.from && { timestamp: { gte: options.from } }),
        ...(options?.to && { timestamp: { lte: options.to } }),
      },
      _count: true,
      _avg: {
        latencyMs: true,
      },
      _sum: {
        tokensIn: true,
        tokensOut: true,
        cost: true,
      },
    });

    return {
      count: result._count,
      avgLatencyMs: result._avg.latencyMs ?? 0,
      totalTokensIn: result._sum.tokensIn ?? 0,
      totalTokensOut: result._sum.tokensOut ?? 0,
      totalCost: result._sum.cost ?? 0,
    };
  }

  private toRequestLog(log: any): RequestLog {
    return {
      id: log.id,
      timestamp: log.timestamp,
      providerId: log.providerId,
      modelId: log.modelId,
      latencyMs: log.latencyMs,
      tokensIn: log.tokensIn ?? undefined,
      tokensOut: log.tokensOut ?? undefined,
      cost: log.cost ?? undefined,
      status: log.status as RequestLog['status'],
      errorMessage: log.errorMessage ?? undefined,
      metadata: log.metadata as Record<string, unknown> | undefined,
    };
  }
}

/**
 * =========================================================================
 * CODING AGENTS - Repository interfaces and implementations
 * =========================================================================
 */

/** Workspace information */
export interface WorkspaceInfo {
  id: string;
  name: string;
  rootPath: string;
  policy: WorkspacePolicy;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/** Agent information */
export interface AgentInfo {
  id: string;
  name: string;
  version: string;
  binaryPath: string;
  capabilities: AgentCapability[];
  requiredEnv: string[];
  installed: boolean;
  lastDetected?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceRepository {
  create(workspace: Omit<WorkspaceInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkspaceInfo>;
  findById(id: string): Promise<WorkspaceInfo | null>;
  findByName(name: string): Promise<WorkspaceInfo | null>;
  list(): Promise<WorkspaceInfo[]>;
  update(id: string, updates: Partial<Omit<WorkspaceInfo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface AgentRepository {
  save(agent: Omit<AgentInfo, 'createdAt' | 'updatedAt'>): Promise<AgentInfo>;
  findById(id: string): Promise<AgentInfo | null>;
  list(options?: { installed?: boolean }): Promise<AgentInfo[]>;
  updateDetection(id: string, installed: boolean, version?: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface JobRepository {
  create(job: Omit<AgentJob, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<AgentJob>;
  findById(id: string): Promise<AgentJob | null>;
  list(options?: { workspaceId?: string; agentId?: string; status?: string }): Promise<AgentJob[]>;
  updateStatus(id: string, status: AgentJob['status']): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface RunRepository {
  create(run: Omit<AgentRunResult, 'artifacts' | 'events' | 'completedAt'>): Promise<AgentRunResult>;
  findById(id: string): Promise<AgentRunResult | null>;
  updateStatus(
    id: string,
    status: AgentRunResult['status'],
    options?: { exitCode?: number; errorMessage?: string }
  ): Promise<void>;
  complete(id: string, result: { exitCode: number; tokensUsed?: number; cost?: number }): Promise<void>;
  list(options?: { jobId?: string; status?: string }): Promise<AgentRunResult[]>;
}

export interface ArtifactRepository {
  save(artifact: Omit<Artifact, 'id'>): Promise<Artifact>;
  findByRun(runId: string): Promise<Artifact[]>;
  delete(id: string): Promise<void>;
}

export interface AgentEventRepository {
  save(event: Omit<AgentEvent, 'id'>): Promise<AgentEvent>;
  findByRun(runId: string, options?: { limit?: number }): Promise<AgentEvent[]>;
  delete(id: string): Promise<void>;
}

/**
 * Prisma-based agent repository implementations
 */

export class PrismaWorkspaceRepository implements WorkspaceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(workspace: Omit<WorkspaceInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkspaceInfo> {
    try {
      const result = await this.prisma.workspace.create({
        data: {
          name: workspace.name,
          rootPath: workspace.rootPath,
          allowedPaths: workspace.policy.allowedPaths,
          forbiddenPaths: workspace.policy.forbiddenPaths,
          allowedCommands: workspace.policy.allowedCommands ?? [],
          forbiddenCommands: workspace.policy.forbiddenCommands ?? [],
          maxFileSizeBytes: workspace.policy.maxFileSizeBytes,
          maxFilesPerOp: workspace.policy.maxFilesPerOp,
          metadata: workspace.metadata as any,
        },
      });
      return this.toWorkspaceInfo(result);
    } catch (error) {
      throw storageError('Failed to create workspace', error as Error);
    }
  }

  async findById(id: string): Promise<WorkspaceInfo | null> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    return workspace ? this.toWorkspaceInfo(workspace) : null;
  }

  async findByName(name: string): Promise<WorkspaceInfo | null> {
    const workspace = await this.prisma.workspace.findUnique({ where: { name } });
    return workspace ? this.toWorkspaceInfo(workspace) : null;
  }

  async list(): Promise<WorkspaceInfo[]> {
    const workspaces = await this.prisma.workspace.findMany();
    return workspaces.map((w: any) => this.toWorkspaceInfo(w));
  }

  async update(
    id: string,
    updates: Partial<Omit<WorkspaceInfo, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    await this.prisma.workspace.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.rootPath && { rootPath: updates.rootPath }),
        ...(updates.policy && {
          allowedPaths: updates.policy.allowedPaths,
          forbiddenPaths: updates.policy.forbiddenPaths,
          allowedCommands: updates.policy.allowedCommands,
          forbiddenCommands: updates.policy.forbiddenCommands,
          maxFileSizeBytes: updates.policy.maxFileSizeBytes,
          maxFilesPerOp: updates.policy.maxFilesPerOp,
        }),
        ...(updates.metadata && { metadata: updates.metadata as any }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workspace.delete({ where: { id } });
  }

  private toWorkspaceInfo(workspace: any): WorkspaceInfo {
    return {
      id: workspace.id,
      name: workspace.name,
      rootPath: workspace.rootPath,
      policy: {
        allowedPaths: workspace.allowedPaths,
        forbiddenPaths: workspace.forbiddenPaths,
        allowedCommands: workspace.allowedCommands,
        forbiddenCommands: workspace.forbiddenCommands,
        maxFileSizeBytes: workspace.maxFileSizeBytes ?? undefined,
        maxFilesPerOp: workspace.maxFilesPerOp ?? undefined,
      },
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      metadata: workspace.metadata as Record<string, unknown> | undefined,
    };
  }
}

export class PrismaAgentRepository implements AgentRepository {
  constructor(private prisma: PrismaClient) {}

  async save(agent: Omit<AgentInfo, 'createdAt' | 'updatedAt'>): Promise<AgentInfo> {
    try {
      const result = await this.prisma.agent.upsert({
        where: { id: agent.id },
        create: {
          id: agent.id,
          name: agent.name,
          version: agent.version,
          binaryPath: agent.binaryPath,
          capabilities: agent.capabilities,
          requiredEnv: agent.requiredEnv,
          installed: agent.installed,
          lastDetected: agent.lastDetected,
          metadata: agent.metadata as any,
        },
        update: {
          name: agent.name,
          version: agent.version,
          binaryPath: agent.binaryPath,
          capabilities: agent.capabilities,
          requiredEnv: agent.requiredEnv,
          installed: agent.installed,
          lastDetected: agent.lastDetected,
          metadata: agent.metadata as any,
        },
      });
      return this.toAgentInfo(result);
    } catch (error) {
      throw storageError('Failed to save agent', error as Error);
    }
  }

  async findById(id: string): Promise<AgentInfo | null> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    return agent ? this.toAgentInfo(agent) : null;
  }

  async list(options?: { installed?: boolean }): Promise<AgentInfo[]> {
    const agents = await this.prisma.agent.findMany({
      where: options?.installed !== undefined ? { installed: options.installed } : undefined,
    });
    return agents.map((a: any) => this.toAgentInfo(a));
  }

  async updateDetection(id: string, installed: boolean, version?: string): Promise<void> {
    await this.prisma.agent.update({
      where: { id },
      data: {
        installed,
        ...(version && { version }),
        lastDetected: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.agent.delete({ where: { id } });
  }

  private toAgentInfo(agent: any): AgentInfo {
    return {
      id: agent.id,
      name: agent.name,
      version: agent.version,
      binaryPath: agent.binaryPath,
      capabilities: agent.capabilities as AgentCapability[],
      requiredEnv: agent.requiredEnv,
      installed: agent.installed,
      lastDetected: agent.lastDetected ?? undefined,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      metadata: agent.metadata as Record<string, unknown> | undefined,
    };
  }
}

export class PrismaJobRepository implements JobRepository {
  constructor(private prisma: PrismaClient) {}

  async create(job: Omit<AgentJob, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<AgentJob> {
    try {
      const result = await this.prisma.agentJob.create({
        data: {
          workspaceId: job.workspaceId,
          agentId: job.agentId,
          task: job.task,
          contextFiles: job.contextFiles ?? [],
          profileName: job.profile.name,
          allowNetwork: job.profile.allowNetwork,
          allowShell: job.profile.allowShell,
          timeoutMs: job.profile.timeoutMs,
          env: job.profile.env as any,
          cwd: job.profile.cwd,
          metadata: job.metadata as any,
        },
      });
      return this.toAgentJob(result);
    } catch (error) {
      throw storageError('Failed to create job', error as Error);
    }
  }

  async findById(id: string): Promise<AgentJob | null> {
    const job = await this.prisma.agentJob.findUnique({ where: { id } });
    return job ? this.toAgentJob(job) : null;
  }

  async list(options?: { workspaceId?: string; agentId?: string; status?: string }): Promise<AgentJob[]> {
    const jobs = await this.prisma.agentJob.findMany({
      where: {
        ...(options?.workspaceId && { workspaceId: options.workspaceId }),
        ...(options?.agentId && { agentId: options.agentId }),
        ...(options?.status && { status: options.status }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return jobs.map((j: any) => this.toAgentJob(j));
  }

  async updateStatus(id: string, status: AgentJob['status']): Promise<void> {
    await this.prisma.agentJob.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.agentJob.delete({ where: { id } });
  }

  private toAgentJob(job: any): AgentJob {
    return {
      id: job.id,
      workspaceId: job.workspaceId,
      agentId: job.agentId,
      task: job.task,
      contextFiles: job.contextFiles,
      profile: {
        name: job.profileName,
        allowNetwork: job.allowNetwork,
        allowShell: job.allowShell,
        timeoutMs: job.timeoutMs,
        env: job.env as Record<string, string> | undefined,
        cwd: job.cwd ?? undefined,
      },
      status: job.status as AgentJob['status'],
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      metadata: job.metadata as Record<string, unknown> | undefined,
    };
  }
}

export class PrismaRunRepository implements RunRepository {
  constructor(private prisma: PrismaClient) {}

  async create(run: Omit<AgentRunResult, 'artifacts' | 'events' | 'completedAt'>): Promise<AgentRunResult> {
    try {
      const result = await this.prisma.agentRun.create({
        data: {
          jobId: run.runId, // Using runId as the primary identifier
          status: run.status,
          exitCode: run.exitCode,
          tokensUsed: run.tokensUsed,
          cost: run.cost,
          errorMessage: run.errorMessage,
        },
      });
      return this.toAgentRunResult(result, [], []);
    } catch (error) {
      throw storageError('Failed to create run', error as Error);
    }
  }

  async findById(id: string): Promise<AgentRunResult | null> {
    const run = await this.prisma.agentRun.findUnique({
      where: { id },
      include: {
        artifacts: true,
        events: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!run) return null;
    return this.toAgentRunResult(run, run.artifacts, run.events);
  }

  async updateStatus(
    id: string,
    status: AgentRunResult['status'],
    options?: { exitCode?: number; errorMessage?: string }
  ): Promise<void> {
    await this.prisma.agentRun.update({
      where: { id },
      data: {
        status,
        ...(options?.exitCode !== undefined && { exitCode: options.exitCode }),
        ...(options?.errorMessage && { errorMessage: options.errorMessage }),
      },
    });
  }

  async complete(id: string, result: { exitCode: number; tokensUsed?: number; cost?: number }): Promise<void> {
    await this.prisma.agentRun.update({
      where: { id },
      data: {
        status: result.exitCode === 0 ? 'completed' : 'failed',
        exitCode: result.exitCode,
        completedAt: new Date(),
        tokensUsed: result.tokensUsed,
        cost: result.cost,
      },
    });
  }

  async list(options?: { jobId?: string; status?: string }): Promise<AgentRunResult[]> {
    const runs = await this.prisma.agentRun.findMany({
      where: {
        ...(options?.jobId && { jobId: options.jobId }),
        ...(options?.status && { status: options.status }),
      },
      include: {
        artifacts: true,
        events: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { startedAt: 'desc' },
    });
    return runs.map((r: any) => this.toAgentRunResult(r, r.artifacts, r.events));
  }

  private toAgentRunResult(run: any, artifacts: any[], events: any[]): AgentRunResult {
    return {
      runId: run.id,
      status: run.status as AgentRunResult['status'],
      exitCode: run.exitCode ?? undefined,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? undefined,
      tokensUsed: run.tokensUsed ?? undefined,
      cost: run.cost ?? undefined,
      artifacts: artifacts.map((a: any) => ({
        id: a.id,
        runId: a.runId,
        path: a.path,
        operation: a.operation as Artifact['operation'],
        content: a.content ?? undefined,
        diff: a.diff ?? undefined,
        timestamp: a.timestamp.getTime(),
      })),
      events: events.map((e: any) => ({
        id: e.id,
        runId: e.runId,
        type: e.type as AgentEvent['type'],
        timestamp: e.timestamp.getTime(),
        data: e.data as Record<string, unknown>,
        sequence: e.sequence,
      })),
      errorMessage: run.errorMessage ?? undefined,
    };
  }
}

export class PrismaArtifactRepository implements ArtifactRepository {
  constructor(private prisma: PrismaClient) {}

  async save(artifact: Omit<Artifact, 'id'>): Promise<Artifact> {
    try {
      const result = await this.prisma.artifact.create({
        data: {
          runId: artifact.runId,
          path: artifact.path,
          operation: artifact.operation,
          content: artifact.content,
          diff: artifact.diff,
          timestamp: new Date(artifact.timestamp),
        },
      });
      return {
        id: result.id,
        runId: result.runId,
        path: result.path,
        operation: result.operation as Artifact['operation'],
        content: result.content ?? undefined,
        diff: result.diff ?? undefined,
        timestamp: result.timestamp.getTime(),
      };
    } catch (error) {
      throw storageError('Failed to save artifact', error as Error);
    }
  }

  async findByRun(runId: string): Promise<Artifact[]> {
    const artifacts = await this.prisma.artifact.findMany({
      where: { runId },
      orderBy: { timestamp: 'asc' },
    });
    return artifacts.map((a: any) => ({
      id: a.id,
      runId: a.runId,
      path: a.path,
      operation: a.operation as Artifact['operation'],
      content: a.content ?? undefined,
      diff: a.diff ?? undefined,
      timestamp: a.timestamp.getTime(),
    }));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.artifact.delete({ where: { id } });
  }
}

export class PrismaAgentEventRepository implements AgentEventRepository {
  constructor(private prisma: PrismaClient) {}

  async save(event: Omit<AgentEvent, 'id'>): Promise<AgentEvent> {
    try {
      const result = await this.prisma.agentEvent.create({
        data: {
          runId: event.runId,
          type: event.type,
          timestamp: new Date(event.timestamp),
          data: event.data as any,
          sequence: event.sequence,
        },
      });
      return {
        id: result.id,
        runId: result.runId,
        type: result.type as AgentEvent['type'],
        timestamp: result.timestamp.getTime(),
        data: result.data as Record<string, unknown>,
        sequence: result.sequence,
      };
    } catch (error) {
      throw storageError('Failed to save event', error as Error);
    }
  }

  async findByRun(runId: string, options?: { limit?: number }): Promise<AgentEvent[]> {
    const events = await this.prisma.agentEvent.findMany({
      where: { runId },
      orderBy: { sequence: 'asc' },
      take: options?.limit,
    });
    return events.map((e: any) => ({
      id: e.id,
      runId: e.runId,
      type: e.type as AgentEvent['type'],
      timestamp: e.timestamp.getTime(),
      data: e.data as Record<string, unknown>,
      sequence: e.sequence,
    }));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.agentEvent.delete({ where: { id } });
  }
}
