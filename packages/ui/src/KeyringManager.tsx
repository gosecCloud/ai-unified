/**
 * Keyring manager component (headless)
 */

import React, { useState, useEffect } from 'react';

export interface ApiKeyInfo {
  /** Unique alias for the key */
  alias: string;
  /** Provider ID */
  providerId: string;
  /** Whether the key is valid */
  valid: boolean;
  /** API scopes/capabilities */
  scopes?: string[];
  /** Creation timestamp */
  createdAt: Date;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  scopes?: string[];
}

export interface KeyringManagerProps {
  /** Load all stored keys */
  onLoadKeys: () => Promise<ApiKeyInfo[]>;
  /** Add a new API key */
  onAddKey: (providerId: string, key: string, alias: string) => Promise<void>;
  /** Validate an API key */
  onValidateKey: (providerId: string, key: string) => Promise<ValidationResult>;
  /** Delete an API key */
  onDeleteKey: (alias: string) => Promise<void>;
  /** Available provider IDs */
  availableProviders?: string[];
  /** Render prop */
  children: (props: {
    keys: ApiKeyInfo[];
    isLoading: boolean;
    isAdding: boolean;
    isValidating: boolean;
    error?: Error;
    addKey: (providerId: string, key: string, alias: string) => Promise<void>;
    validateKey: (providerId: string, key: string) => Promise<ValidationResult>;
    deleteKey: (alias: string) => Promise<void>;
    refreshKeys: () => Promise<void>;
  }) => React.ReactNode;
}

/**
 * Headless keyring manager component
 */
export function KeyringManager({
  onLoadKeys,
  onAddKey,
  onValidateKey,
  onDeleteKey,
  children,
}: KeyringManagerProps) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error>();

  // Load keys on mount
  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const loadedKeys = await onLoadKeys();
      setKeys(loadedKeys);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load keys'));
    } finally {
      setIsLoading(false);
    }
  };

  const addKey = async (providerId: string, key: string, alias: string) => {
    setIsAdding(true);
    setError(undefined);

    try {
      await onAddKey(providerId, key, alias);
      await loadKeys(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add key'));
      throw err; // Re-throw for caller
    } finally {
      setIsAdding(false);
    }
  };

  const validateKey = async (providerId: string, key: string): Promise<ValidationResult> => {
    setIsValidating(true);
    setError(undefined);

    try {
      const result = await onValidateKey(providerId, key);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to validate key'));
      throw err;
    } finally {
      setIsValidating(false);
    }
  };

  const deleteKey = async (alias: string) => {
    setError(undefined);

    try {
      await onDeleteKey(alias);
      setKeys(prev => prev.filter(k => k.alias !== alias));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete key'));
      throw err;
    }
  };

  const refreshKeys = async () => {
    await loadKeys();
  };

  return (
    <>
      {children({
        keys,
        isLoading,
        isAdding,
        isValidating,
        error,
        addKey,
        validateKey,
        deleteKey,
        refreshKeys,
      })}
    </>
  );
}
