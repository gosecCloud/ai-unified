/**
 * ProcessRunner - Spawns and manages agent processes with timeout and streaming
 */

import { spawn, type ChildProcess } from 'child_process';
import { createLogger } from '@aiu/observability';
import type { SandboxProfile } from '@aiu/core';

export interface ProcessOptions {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args: string[];
  /** Sandbox profile */
  profile: SandboxProfile;
  /** Working directory */
  cwd?: string;
  /** Callback for stdout data */
  onStdout?: (data: string) => void;
  /** Callback for stderr data */
  onStderr?: (data: string) => void;
  /** Callback for process exit */
  onExit?: (code: number | null, signal: string | null) => void;
}

export interface ProcessResult {
  /** Exit code (0 = success) */
  exitCode: number | null;
  /** Exit signal (e.g., SIGTERM) */
  signal: string | null;
  /** Accumulated stdout */
  stdout: string;
  /** Accumulated stderr */
  stderr: string;
  /** Execution time in milliseconds */
  durationMs: number;
}

/**
 * ProcessRunner - Manages agent process lifecycle
 */
export class ProcessRunner {
  private logger: any;
  private process: ChildProcess | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private stdout = '';
  private stderr = '';
  private startTime = 0;

  constructor(logger?: any) {
    this.logger = logger ?? createLogger({ level: 'info' });
  }

  /**
   * Spawn a new agent process
   */
  async run(options: ProcessOptions): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      this.startTime = Date.now();
      this.stdout = '';
      this.stderr = '';

      // Build environment variables
      const env = {
        ...process.env,
        ...options.profile.env,
      };

      // Spawn process
      this.logger.info(
        {
          command: options.command,
          args: options.args,
          cwd: options.cwd ?? options.profile.cwd,
          timeout: options.profile.timeoutMs,
        },
        'Spawning agent process'
      );

      this.process = spawn(options.command, options.args, {
        cwd: options.cwd ?? options.profile.cwd ?? process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, stdout/stderr piped
      });

      // Set timeout
      this.timeoutId = setTimeout(() => {
        this.logger.warn(
          { timeoutMs: options.profile.timeoutMs },
          'Process timeout reached, killing process'
        );
        this.kill();
      }, options.profile.timeoutMs);

      // Handle stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        this.stdout += text;
        options.onStdout?.(text);
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        this.stderr += text;
        options.onStderr?.(text);
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }

        const durationMs = Date.now() - this.startTime;

        this.logger.info(
          { exitCode: code, signal, durationMs },
          'Process exited'
        );

        options.onExit?.(code, signal);

        const result: ProcessResult = {
          exitCode: code,
          signal,
          stdout: this.stdout,
          stderr: this.stderr,
          durationMs,
        };

        this.process = null;

        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          reject(new Error(`Process killed by signal: ${signal}`));
        } else {
          resolve(result);
        }
      });

      // Handle process error
      this.process.on('error', (error) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }

        this.logger.error({ error }, 'Process error');
        this.process = null;
        reject(error);
      });
    });
  }

  /**
   * Kill the running process
   */
  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    if (!this.process) {
      return false;
    }

    this.logger.info({ signal }, 'Killing process');
    return this.process.kill(signal);
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get process PID
   */
  getPid(): number | undefined {
    return this.process?.pid;
  }
}
