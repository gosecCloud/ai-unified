/**
 * EventParser - Parses agent CLI output into structured AgentEvent stream
 */

import { createLogger } from '@aiu/observability';
import type { AgentEvent, AgentEventType } from '@aiu/core';
import { randomUUID } from 'crypto';

export interface ParseOptions {
  /** Run ID for event association */
  runId: string;
  /** Starting sequence number */
  startSequence?: number;
}

/**
 * EventParser - Converts raw CLI output to AgentEvent stream
 */
export class EventParser {
  private logger: any;
  private sequence = 0;

  constructor(logger?: any) {
    this.logger = logger ?? createLogger({ level: 'info' });
  }

  /**
   * Parse a line of output into an AgentEvent (if recognized)
   */
  parseLine(line: string, runId: string): AgentEvent | null {
    // Skip empty lines
    if (!line.trim()) {
      return null;
    }

    // Try to parse as JSON (structured output)
    if (line.startsWith('{') || line.startsWith('[')) {
      try {
        const json = JSON.parse(line);
        return this.parseStructuredEvent(json, runId);
      } catch {
        // Not valid JSON, continue with pattern matching
      }
    }

    // Pattern matching for common CLI output formats
    const event = this.parsePatterns(line, runId);
    if (event) {
      return event;
    }

    // Default: treat as progress event
    return this.createEvent(runId, 'progress', {
      message: line.trim(),
    });
  }

  /**
   * Parse structured JSON event
   */
  private parseStructuredEvent(json: any, runId: string): AgentEvent | null {
    // Claude Code format: { type: 'tool_use', tool: 'edit', ... }
    if (json.type === 'tool_use') {
      return this.createEvent(runId, 'tool_use', {
        tool: json.tool,
        input: json.input,
      });
    }

    // Generic event format: { event: 'file_edit', data: {...} }
    if (json.event && typeof json.event === 'string') {
      const eventType = this.normalizeEventType(json.event);
      return this.createEvent(runId, eventType, json.data ?? {});
    }

    return null;
  }

  /**
   * Parse output using regex patterns
   */
  private parsePatterns(line: string, runId: string): AgentEvent | null {
    // File edit patterns
    const fileMatch = line.match(/^(Created|Updated|Modified|Deleted)\s+(.+)$/i);
    if (fileMatch) {
      const operation = fileMatch[1]!.toLowerCase();
      const path = fileMatch[2]!.trim();
      return this.createEvent(runId, 'file_edit', {
        operation,
        path,
      });
    }

    // Shell execution patterns
    const shellMatch = line.match(/^(Running|Executing)\s+command:\s+(.+)$/i);
    if (shellMatch) {
      const command = shellMatch[2]!.trim();
      return this.createEvent(runId, 'shell_exec', {
        command,
      });
    }

    // Task start patterns
    const taskStartMatch = line.match(/^(Starting|Beginning)\s+task:\s+(.+)$/i);
    if (taskStartMatch) {
      const task = taskStartMatch[2]!.trim();
      return this.createEvent(runId, 'task_start', {
        task,
      });
    }

    // Task complete patterns
    if (line.match(/^(Completed|Finished)\s+task/i)) {
      return this.createEvent(runId, 'task_complete', {
        message: line.trim(),
      });
    }

    // Error patterns
    if (line.match(/^(Error|Failed|Exception):/i)) {
      return this.createEvent(runId, 'error', {
        message: line.trim(),
      });
    }

    return null;
  }

  /**
   * Normalize event type string to AgentEventType
   */
  private normalizeEventType(type: string): AgentEventType {
    const normalized = type.toLowerCase().replace(/[_-]/g, '_');

    switch (normalized) {
      case 'task_start':
      case 'start':
        return 'task_start';
      case 'task_complete':
      case 'complete':
      case 'done':
        return 'task_complete';
      case 'tool_use':
      case 'tool':
        return 'tool_use';
      case 'file_edit':
      case 'file':
      case 'edit':
        return 'file_edit';
      case 'shell_exec':
      case 'shell':
      case 'command':
        return 'shell_exec';
      case 'error':
      case 'fail':
        return 'error';
      default:
        return 'progress';
    }
  }

  /**
   * Create an AgentEvent
   */
  private createEvent(
    runId: string,
    type: AgentEventType,
    data: Record<string, unknown>
  ): AgentEvent {
    return {
      id: randomUUID(),
      runId,
      type,
      timestamp: Date.now(),
      data,
      sequence: this.sequence++,
    };
  }

  /**
   * Parse a stream of lines into AgentEvents
   */
  async *parseStream(
    lines: AsyncIterable<string>,
    runId: string
  ): AsyncIterable<AgentEvent> {
    for await (const line of lines) {
      const event = this.parseLine(line, runId);
      if (event) {
        this.logger.debug({ event }, 'Parsed event from output');
        yield event;
      }
    }
  }

  /**
   * Parse stdout/stderr buffers into line stream
   */
  async *bufferToLines(text: string): AsyncIterable<string> {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        yield line;
      }
    }
  }

  /**
   * Reset sequence counter
   */
  resetSequence(start = 0): void {
    this.sequence = start;
  }
}
