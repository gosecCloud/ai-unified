/**
 * Keyring for managing encrypted API keys
 */

import { encrypt, decrypt, generateKey } from './crypto.js';
import type { ApiKeyInfo, KeyStatus } from '@aiu/core';
import { encryptionError, validationError } from '@aiu/core';

export interface KeyringOptions {
  /** Master encryption key (32 bytes) */
  masterKey: Buffer;
}

export interface StoredKey {
  id: string;
  providerId: string;
  alias: string;
  keyCiphertext: string;
  status: KeyStatus;
  scopes?: string[];
  createdAt: Date;
  lastValidatedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface SaveKeyOptions {
  providerId: string;
  alias: string;
  key: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * In-memory keyring for managing encrypted API keys
 */
export class Keyring {
  private masterKey: Buffer;
  private keys = new Map<string, StoredKey>();

  constructor(options: KeyringOptions) {
    if (options.masterKey.length !== 32) {
      throw encryptionError('Master key must be 32 bytes');
    }
    this.masterKey = options.masterKey;
  }

  /**
   * Generate a new master key
   */
  static generateMasterKey(): Buffer {
    return generateKey();
  }

  /**
   * Save an API key (encrypts and stores)
   */
  save(options: SaveKeyOptions): StoredKey {
    const id = this.generateKeyId(options.providerId, options.alias);

    // Encrypt the key with provider ID as associated data
    const keyCiphertext = encrypt(options.key, this.masterKey, options.providerId);

    const storedKey: StoredKey = {
      id,
      providerId: options.providerId,
      alias: options.alias,
      keyCiphertext,
      status: 'active',
      scopes: options.scopes,
      createdAt: new Date(),
      metadata: options.metadata,
    };

    this.keys.set(id, storedKey);
    return storedKey;
  }

  /**
   * Get and decrypt an API key
   */
  get(providerId: string, alias: string): string {
    const id = this.generateKeyId(providerId, alias);
    const storedKey = this.keys.get(id);

    if (!storedKey) {
      throw validationError(`Key not found: ${providerId}/${alias}`);
    }

    if (storedKey.status !== 'active') {
      throw validationError(`Key is ${storedKey.status}: ${providerId}/${alias}`);
    }

    // Decrypt with provider ID as associated data
    return decrypt(storedKey.keyCiphertext, this.masterKey, providerId);
  }

  /**
   * Get key metadata without decrypting
   */
  getInfo(providerId: string, alias: string): ApiKeyInfo | undefined {
    const id = this.generateKeyId(providerId, alias);
    const storedKey = this.keys.get(id);
    return storedKey ? this.toApiKeyInfo(storedKey) : undefined;
  }

  /**
   * List all stored keys (metadata only, no decryption)
   */
  list(providerId?: string): ApiKeyInfo[] {
    const keys = Array.from(this.keys.values());
    const filtered = providerId ? keys.filter((k) => k.providerId === providerId) : keys;
    return filtered.map((k) => this.toApiKeyInfo(k));
  }

  /**
   * Update key status
   */
  updateStatus(providerId: string, alias: string, status: KeyStatus): void {
    const id = this.generateKeyId(providerId, alias);
    const storedKey = this.keys.get(id);

    if (!storedKey) {
      throw validationError(`Key not found: ${providerId}/${alias}`);
    }

    storedKey.status = status;
  }

  /**
   * Mark a key as validated
   */
  markValidated(providerId: string, alias: string, scopes?: string[]): void {
    const id = this.generateKeyId(providerId, alias);
    const storedKey = this.keys.get(id);

    if (!storedKey) {
      throw validationError(`Key not found: ${providerId}/${alias}`);
    }

    storedKey.lastValidatedAt = new Date();
    if (scopes) {
      storedKey.scopes = scopes;
    }
  }

  /**
   * Delete a key
   */
  delete(providerId: string, alias: string): boolean {
    const id = this.generateKeyId(providerId, alias);
    return this.keys.delete(id);
  }

  /**
   * Check if a key exists
   */
  has(providerId: string, alias: string): boolean {
    const id = this.generateKeyId(providerId, alias);
    return this.keys.has(id);
  }

  /**
   * Rotate a key (save new key, mark old as revoked)
   */
  rotate(options: SaveKeyOptions & { oldAlias?: string }): StoredKey {
    const oldAlias = options.oldAlias || options.alias;

    if (this.has(options.providerId, oldAlias)) {
      this.updateStatus(options.providerId, oldAlias, 'revoked');
    }

    return this.save(options);
  }

  /**
   * Export encrypted keys (for storage persistence)
   */
  export(): StoredKey[] {
    return Array.from(this.keys.values());
  }

  /**
   * Import encrypted keys (from storage)
   */
  import(keys: StoredKey[]): void {
    for (const key of keys) {
      this.keys.set(key.id, key);
    }
  }

  /**
   * Clear all keys from memory
   */
  clear(): void {
    this.keys.clear();
  }

  private generateKeyId(providerId: string, alias: string): string {
    return `${providerId}:${alias}`;
  }

  private toApiKeyInfo(storedKey: StoredKey): ApiKeyInfo {
    return {
      id: storedKey.id,
      providerId: storedKey.providerId,
      alias: storedKey.alias,
      keyCiphertext: storedKey.keyCiphertext,
      status: storedKey.status,
      scopes: storedKey.scopes,
      createdAt: storedKey.createdAt,
      lastValidatedAt: storedKey.lastValidatedAt,
      metadata: storedKey.metadata,
    };
  }
}
