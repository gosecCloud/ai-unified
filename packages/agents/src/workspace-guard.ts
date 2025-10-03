/**
 * WorkspaceGuard - Validates paths and enforces workspace policies
 */

import { resolve, normalize, relative, isAbsolute } from 'path';
import { createLogger } from '@aiu/observability';
import type { WorkspacePolicy } from '@aiu/core';
import micromatch from 'micromatch';

export interface ValidationResult {
  /** Whether the operation is allowed */
  allowed: boolean;
  /** Reason for denial (if not allowed) */
  reason?: string;
}

/**
 * WorkspaceGuard - Enforces workspace security policies
 */
export class WorkspaceGuard {
  private logger: any;
  private rootPath: string;
  private policy: WorkspacePolicy;

  constructor(rootPath: string, policy: WorkspacePolicy, logger?: any) {
    this.logger = logger ?? createLogger({ level: 'info' });
    this.rootPath = normalize(resolve(rootPath));
    this.policy = policy;

    this.logger.info(
      {
        rootPath: this.rootPath,
        allowedPaths: policy.allowedPaths.length,
        forbiddenPaths: policy.forbiddenPaths.length,
      },
      'WorkspaceGuard initialized'
    );
  }

  /**
   * Validate a file path operation
   */
  validatePath(path: string, operation: 'read' | 'write' | 'delete' = 'read'): ValidationResult {
    // Normalize path
    const normalizedPath = normalize(path);
    const absolutePath = isAbsolute(normalizedPath)
      ? normalizedPath
      : resolve(this.rootPath, normalizedPath);

    // Check if path is within workspace root
    const relativePath = relative(this.rootPath, absolutePath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      this.logger.warn(
        { path, absolutePath, rootPath: this.rootPath },
        'Path outside workspace root'
      );
      return {
        allowed: false,
        reason: 'Path is outside workspace root',
      };
    }

    // Check against forbidden paths
    const isForbidden = micromatch.isMatch(
      relativePath,
      this.policy.forbiddenPaths,
      { dot: true }
    );

    if (isForbidden) {
      this.logger.warn(
        { path: relativePath, forbiddenPaths: this.policy.forbiddenPaths },
        'Path matches forbidden pattern'
      );
      return {
        allowed: false,
        reason: 'Path matches forbidden pattern',
      };
    }

    // Check against allowed paths (if specified)
    if (this.policy.allowedPaths.length > 0) {
      const isAllowed = micromatch.isMatch(
        relativePath,
        this.policy.allowedPaths,
        { dot: true }
      );

      if (!isAllowed) {
        this.logger.warn(
          { path: relativePath, allowedPaths: this.policy.allowedPaths },
          'Path does not match allowed patterns'
        );
        return {
          allowed: false,
          reason: 'Path does not match allowed patterns',
        };
      }
    }

    this.logger.debug(
      { path: relativePath, operation },
      'Path validation passed'
    );

    return { allowed: true };
  }

  /**
   * Validate multiple file paths
   */
  validatePaths(paths: string[], operation: 'read' | 'write' | 'delete' = 'read'): ValidationResult {
    // Check file count limit
    if (this.policy.maxFilesPerOp && paths.length > this.policy.maxFilesPerOp) {
      this.logger.warn(
        { count: paths.length, max: this.policy.maxFilesPerOp },
        'Too many files in single operation'
      );
      return {
        allowed: false,
        reason: `Operation exceeds maximum file count (${this.policy.maxFilesPerOp})`,
      };
    }

    // Validate each path
    for (const path of paths) {
      const result = this.validatePath(path, operation);
      if (!result.allowed) {
        return result;
      }
    }

    return { allowed: true };
  }

  /**
   * Validate a shell command
   */
  validateCommand(command: string): ValidationResult {
    // Check against forbidden commands
    if (this.policy.forbiddenCommands && this.policy.forbiddenCommands.length > 0) {
      for (const pattern of this.policy.forbiddenCommands) {
        const regex = new RegExp(pattern);
        if (regex.test(command)) {
          this.logger.warn(
            { command, pattern },
            'Command matches forbidden pattern'
          );
          return {
            allowed: false,
            reason: `Command matches forbidden pattern: ${pattern}`,
          };
        }
      }
    }

    // Check against allowed commands (if specified)
    if (this.policy.allowedCommands && this.policy.allowedCommands.length > 0) {
      let isAllowed = false;
      for (const pattern of this.policy.allowedCommands) {
        const regex = new RegExp(pattern);
        if (regex.test(command)) {
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        this.logger.warn(
          { command, allowedCommands: this.policy.allowedCommands },
          'Command does not match allowed patterns'
        );
        return {
          allowed: false,
          reason: 'Command does not match allowed patterns',
        };
      }
    }

    this.logger.debug({ command }, 'Command validation passed');
    return { allowed: true };
  }

  /**
   * Validate file size
   */
  validateFileSize(sizeBytes: number): ValidationResult {
    if (this.policy.maxFileSizeBytes && sizeBytes > this.policy.maxFileSizeBytes) {
      this.logger.warn(
        { sizeBytes, max: this.policy.maxFileSizeBytes },
        'File size exceeds limit'
      );
      return {
        allowed: false,
        reason: `File size exceeds maximum (${this.policy.maxFileSizeBytes} bytes)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get absolute path within workspace
   */
  getAbsolutePath(path: string): string {
    const normalizedPath = normalize(path);
    return isAbsolute(normalizedPath)
      ? normalizedPath
      : resolve(this.rootPath, normalizedPath);
  }

  /**
   * Get relative path from workspace root
   */
  getRelativePath(path: string): string {
    const absolutePath = this.getAbsolutePath(path);
    return relative(this.rootPath, absolutePath);
  }
}
