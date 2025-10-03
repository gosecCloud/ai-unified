/**
 * Persistent keyring that syncs with database storage
 */

import { Keyring, type KeyringOptions, type SaveKeyOptions, type StoredKey } from '@aiu/keyring';
import type { ApiKeyRepository } from '@aiu/storage';
import { storageError } from '@aiu/core';
import { createLogger, type Logger } from '@aiu/observability';

export interface PersistentKeyringOptions extends KeyringOptions {
  repository: ApiKeyRepository;
  autoLoad?: boolean;
  logger?: Logger;
}

/**
 * Keyring that automatically persists to database
 */
export class PersistentKeyring extends Keyring {
  private repository: ApiKeyRepository;
  private logger: Logger;

  constructor(options: PersistentKeyringOptions) {
    super(options);
    this.repository = options.repository;
    this.logger = options.logger ?? createLogger({ level: 'info' });

    // Auto-load keys from DB on initialization
    if (options.autoLoad !== false) {
      this.loadFromStorage().catch((error) => {
        this.logger.error({ error }, 'Failed to load keys from storage');
      });
    }
  }

  /**
   * Save key (encrypts and persists to DB)
   */
  override save(options: SaveKeyOptions): StoredKey {
    const storedKey = super.save(options);

    // Persist to database asynchronously (fire-and-forget with error logging)
    this.repository
      .save({
        id: storedKey.id,
        providerId: storedKey.providerId,
        alias: storedKey.alias,
        keyCiphertext: storedKey.keyCiphertext,
        status: storedKey.status,
        scopes: storedKey.scopes,
        createdAt: storedKey.createdAt,
        lastValidatedAt: storedKey.lastValidatedAt,
        metadata: storedKey.metadata,
      })
      .catch((error) => {
        this.logger.error(
          { error, providerId: storedKey.providerId, alias: storedKey.alias },
          'Failed to persist key to database'
        );
      });

    return storedKey;
  }

  /**
   * Delete key (removes from memory and DB)
   */
  override delete(providerId: string, alias: string): boolean {
    const deleted = super.delete(providerId, alias);

    if (deleted) {
      // Remove from database asynchronously
      this.repository
        .findByAlias(providerId, alias)
        .then((key) => {
          if (key) {
            return this.repository.delete(key.id);
          }
        })
        .catch((error) => {
          this.logger.error(
            { error, providerId, alias },
            'Failed to delete key from storage'
          );
        });
    }

    return deleted;
  }

  /**
   * Mark key as validated (updates DB)
   */
  override markValidated(providerId: string, alias: string, scopes?: string[]): void {
    super.markValidated(providerId, alias, scopes);

    // Update in database
    this.repository
      .findByAlias(providerId, alias)
      .then((key) => {
        if (key) {
          return this.repository.markValidated(key.id, scopes);
        }
      })
      .catch((error) => {
        this.logger.error(
          { error, providerId, alias },
          'Failed to update validation in storage'
        );
      });
  }

  /**
   * Load all keys from database
   */
  async loadFromStorage(): Promise<void> {
    try {
      const keys = await this.repository.list();
      super.import(
        keys.map((k) => ({
          id: k.id,
          providerId: k.providerId,
          alias: k.alias,
          keyCiphertext: k.keyCiphertext,
          status: k.status,
          scopes: k.scopes,
          createdAt: k.createdAt,
          lastValidatedAt: k.lastValidatedAt,
          metadata: k.metadata,
        }))
      );
    } catch (error) {
      throw storageError('Failed to load keys from database', error as Error);
    }
  }

  /**
   * Sync in-memory keys to database
   */
  async syncToStorage(): Promise<void> {
    try {
      const keys = super.export();
      for (const key of keys) {
        await this.repository.save({
          id: key.id,
          providerId: key.providerId,
          alias: key.alias,
          keyCiphertext: key.keyCiphertext,
          status: key.status,
          scopes: key.scopes,
          createdAt: key.createdAt,
          lastValidatedAt: key.lastValidatedAt,
          metadata: key.metadata,
        });
      }
    } catch (error) {
      throw storageError('Failed to sync keys to database', error as Error);
    }
  }
}
