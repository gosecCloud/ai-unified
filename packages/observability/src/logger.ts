/**
 * Structured logging with pino
 */

import pino from 'pino';
import { redactSecrets } from '@aiu/core';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type Logger = pino.Logger;

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
  redactSecrets?: boolean;
  base?: Record<string, unknown>;
}

/**
 * Create a logger instance
 */
export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const level = options.level ?? 'info';
  const pretty = options.pretty ?? process.env.NODE_ENV !== 'production';

  const pinoOptions: pino.LoggerOptions = {
    level,
    base: options.base,
    ...(pretty && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    }),
  };

  const logger = pino(pinoOptions);

  // Wrap logger to redact secrets if enabled
  if (options.redactSecrets !== false) {
    return new Proxy(logger, {
      get(target, prop) {
        const original = target[prop as keyof typeof target];
        if (typeof original === 'function' && ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(prop as string)) {
          return function (this: pino.Logger, ...args: unknown[]) {
            // Redact secrets from string arguments
            const redactedArgs = args.map((arg) => {
              if (typeof arg === 'string') {
                return redactSecrets(arg);
              }
              if (typeof arg === 'object' && arg !== null) {
                return redactObjectSecrets(arg);
              }
              return arg;
            });
            return (original as Function).apply(this, redactedArgs);
          };
        }
        return original;
      },
    });
  }

  return logger;
}

/**
 * Redact secrets from objects
 */
function redactObjectSecrets(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObjectSecrets);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password')) {
      redacted[key] = '***';
    } else if (typeof value === 'string') {
      redacted[key] = redactSecrets(value);
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObjectSecrets(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Create a child logger with additional context
 */
export function withContext(logger: pino.Logger, context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Default logger instance
 */
export const defaultLogger = createLogger();
