/**
 * Codex adapter - OpenAI's autonomous coding agent
 */

import type { AgentAdapter, AgentJob, AgentEvent, AgentCapability, AgentRunResult } from '@aiu/core';
import { ProcessRunner } from '../process-runner.js';
import { WorkspaceGuard } from '../workspace-guard.js';
import { EventParser } from '../event-parser.js';
import { createLogger } from '@aiu/observability';
import { randomUUID } from 'crypto';

const CODEX_BINARY = 'codex';
const REQUIRED_ENV = ['OPENAI_API_KEY'];

/**
 * CodexAdapter - Adapter for OpenAI Codex CLI
 */
export class CodexAdapter implements AgentAdapter {
  private logger: any;
  private eventParser: EventParser;
  private activeRuns = new Map<string, ProcessRunner>();

  constructor(logger?: any) {
    this.logger = logger ?? createLogger({ level: 'info' });
    this.eventParser = new EventParser(this.logger);
  }

  /**
   * Get agent information
   */
  info() {
    return {
      id: 'codex',
      name: 'OpenAI Codex',
      version: '1.0.0',
      capabilities: [
        'code-edit',
        'code-generate',
        'code-review',
        'code-refactor',
        'shell',
        'file-read',
        'file-write',
      ] as AgentCapability[],
      binaryPath: CODEX_BINARY,
      requiredEnv: REQUIRED_ENV,
    };
  }

  /**
   * Detect if Codex CLI is installed
   */
  async detect(): Promise<{ installed: boolean; version?: string; path?: string }> {
    const runner = new ProcessRunner(this.logger);

    try {
      const result = await runner.run({
        command: CODEX_BINARY,
        args: ['--version'],
        profile: {
          name: 'detect',
          allowNetwork: false,
          allowShell: false,
          timeoutMs: 5000,
        },
      });

      if (result.exitCode === 0) {
        // Parse version from output
        const versionMatch = result.stdout.match(/(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : undefined;

        this.logger.info(
          { version, path: CODEX_BINARY },
          'Codex CLI detected'
        );

        return {
          installed: true,
          version,
          path: CODEX_BINARY,
        };
      }

      return { installed: false };
    } catch (error) {
      this.logger.debug({ error }, 'Codex CLI not detected');
      return { installed: false };
    }
  }

  /**
   * Validate authentication
   */
  async validateAuth(): Promise<{ valid: boolean; reason?: string }> {
    // Check if OPENAI_API_KEY is set
    if (!process.env.OPENAI_API_KEY) {
      return {
        valid: false,
        reason: 'OPENAI_API_KEY environment variable not set',
      };
    }

    // Try a simple command to verify key works
    const runner = new ProcessRunner(this.logger);

    try {
      const result = await runner.run({
        command: CODEX_BINARY,
        args: ['auth', 'check'],
        profile: {
          name: 'auth-check',
          allowNetwork: true,
          allowShell: false,
          timeoutMs: 10000,
        },
      });

      if (result.exitCode === 0) {
        return { valid: true };
      }

      return {
        valid: false,
        reason: 'Authentication check failed',
      };
    } catch (error: any) {
      return {
        valid: false,
        reason: error.message ?? 'Authentication check failed',
      };
    }
  }

  /**
   * Execute a coding task
   */
  async *execute(job: AgentJob): AsyncIterable<AgentEvent> {
    const runId = randomUUID();
    const runner = new ProcessRunner(this.logger);
    this.activeRuns.set(runId, runner);

    // Create workspace guard
    const guard = new WorkspaceGuard(
      job.workspaceId,
      {
        allowedPaths: ['**/*'],
        forbiddenPaths: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      },
      this.logger
    );

    // Build command arguments
    const args = ['execute'];

    // Add task instruction
    args.push('--task', job.task);

    // Add context files if provided
    if (job.contextFiles && job.contextFiles.length > 0) {
      for (const file of job.contextFiles) {
        // Validate file path
        const validation = guard.validatePath(file, 'read');
        if (!validation.allowed) {
          this.logger.warn(
            { file, reason: validation.reason },
            'Context file blocked by workspace policy'
          );
          continue;
        }
        args.push('--include', guard.getAbsolutePath(file));
      }
    }

    // Add workspace directory
    args.push('--workspace', job.workspaceId);

    // Enable streaming output
    args.push('--stream');

    // Stream output and parse events
    const outputLines: string[] = [];

    this.logger.info(
      { runId, jobId: job.id, task: job.task },
      'Starting Codex execution'
    );

    // Emit task start event
    yield {
      id: randomUUID(),
      runId,
      type: 'task_start',
      timestamp: Date.now(),
      data: { task: job.task },
      sequence: 0,
    };

    // Run process and collect output
    const runPromise = runner.run({
      command: CODEX_BINARY,
      args,
      profile: job.profile,
      cwd: job.workspaceId,
      onStdout: (data) => {
        outputLines.push(...data.split('\n'));
      },
      onStderr: (data) => {
        outputLines.push(...data.split('\n'));
      },
    });

    // Parse output lines as they arrive
    const parseInterval = setInterval(() => {
      while (outputLines.length > 0) {
        const line = outputLines.shift();
        if (line && line.trim()) {
          this.eventParser.parseLine(line, runId);
          // Events collected for yielding
        }
      }
    }, 100);

    try {
      const processResult = await runPromise;
      clearInterval(parseInterval);

      // Parse any remaining output
      for await (const event of this.eventParser.parseStream(
        this.eventParser.bufferToLines(processResult.stdout + processResult.stderr),
        runId
      )) {
        yield event;
      }

      // Emit task complete event
      yield {
        id: randomUUID(),
        runId,
        type: 'task_complete',
        timestamp: Date.now(),
        data: {
          exitCode: processResult.exitCode,
          durationMs: processResult.durationMs,
        },
        sequence: 999,
      };

      this.logger.info(
        { runId, exitCode: processResult.exitCode, durationMs: processResult.durationMs },
        'Codex execution completed'
      );
    } catch (error: any) {
      clearInterval(parseInterval);

      // Emit error event
      yield {
        id: randomUUID(),
        runId,
        type: 'error',
        timestamp: Date.now(),
        data: {
          error: error.message,
        },
        sequence: 999,
      };

      this.logger.error({ runId, error }, 'Codex execution failed');
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  /**
   * Cancel a running job
   */
  async cancel(runId: string): Promise<void> {
    const runner = this.activeRuns.get(runId);
    if (!runner) {
      throw new Error(`No active run found for runId: ${runId}`);
    }

    this.logger.info({ runId }, 'Cancelling Codex execution');
    runner.kill('SIGTERM');
    this.activeRuns.delete(runId);
  }

  /**
   * Get run status
   */
  async getRunStatus(runId: string): Promise<AgentRunResult> {
    const runner = this.activeRuns.get(runId);

    if (!runner) {
      throw new Error(`No active run found for runId: ${runId}`);
    }

    const isRunning = runner.isRunning();

    return {
      runId,
      status: isRunning ? 'running' : 'completed',
      exitCode: undefined,
      startedAt: new Date(),
      artifacts: [],
      events: [],
    };
  }
}
