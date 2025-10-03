/**
 * Gemini CLI adapter - Google's autonomous coding agent
 */

import type { AgentAdapter, AgentJob, AgentEvent, AgentCapability, AgentRunResult } from '@aiu/core';
import { ProcessRunner } from '../process-runner.js';
import { WorkspaceGuard } from '../workspace-guard.js';
import { EventParser } from '../event-parser.js';
import { createLogger } from '@aiu/observability';
import { randomUUID } from 'crypto';

const GEMINI_CLI_BINARY = 'gemini';
const REQUIRED_ENV = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'];

/**
 * GeminiCliAdapter - Adapter for Gemini CLI
 */
export class GeminiCliAdapter implements AgentAdapter {
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
      id: 'gemini-cli',
      name: 'Gemini CLI',
      version: '1.0.0',
      capabilities: [
        'code-edit',
        'code-generate',
        'code-review',
        'code-test',
        'shell',
        'file-read',
        'file-write',
        'web-search',
      ] as AgentCapability[],
      binaryPath: GEMINI_CLI_BINARY,
      requiredEnv: REQUIRED_ENV,
    };
  }

  /**
   * Detect if Gemini CLI is installed
   */
  async detect(): Promise<{ installed: boolean; version?: string; path?: string }> {
    const runner = new ProcessRunner(this.logger);

    try {
      const result = await runner.run({
        command: GEMINI_CLI_BINARY,
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
          { version, path: GEMINI_CLI_BINARY },
          'Gemini CLI detected'
        );

        return {
          installed: true,
          version,
          path: GEMINI_CLI_BINARY,
        };
      }

      return { installed: false };
    } catch (error) {
      this.logger.debug({ error }, 'Gemini CLI not detected');
      return { installed: false };
    }
  }

  /**
   * Validate authentication
   */
  async validateAuth(): Promise<{ valid: boolean; reason?: string }> {
    // Check if either GEMINI_API_KEY or GOOGLE_API_KEY is set
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      return {
        valid: false,
        reason: 'GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set',
      };
    }

    // Try a simple command to verify key works
    const runner = new ProcessRunner(this.logger);

    try {
      const result = await runner.run({
        command: GEMINI_CLI_BINARY,
        args: ['auth', 'status'],
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
    const args = ['code'];

    // Add task instruction
    args.push('--instruction', job.task);

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
        args.push('--context', guard.getAbsolutePath(file));
      }
    }

    // Add workspace directory
    args.push('--directory', job.workspaceId);

    // Enable JSON output for easier parsing
    args.push('--format', 'json');

    // Stream output and parse events
    const outputLines: string[] = [];

    this.logger.info(
      { runId, jobId: job.id, task: job.task },
      'Starting Gemini CLI execution'
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
      command: GEMINI_CLI_BINARY,
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

    // Parse output lines as they arrive (simplified for now)
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
        'Gemini CLI execution completed'
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

      this.logger.error({ runId, error }, 'Gemini CLI execution failed');
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

    this.logger.info({ runId }, 'Cancelling Gemini CLI execution');
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
