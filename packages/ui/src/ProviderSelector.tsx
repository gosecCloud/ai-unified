/**
 * Provider selector component (headless)
 */

import React, { useState, useEffect } from 'react';

export interface ProviderWithKey {
  /** Provider ID */
  id: string;
  /** Provider name */
  name?: string;
  /** Has valid API key */
  hasValidKey: boolean;
  /** Key alias */
  keyAlias?: string;
}

export interface ProviderSelectorProps {
  /** All available provider IDs */
  allProviders?: string[];
  /** Filter: only show providers with valid keys */
  onlyWithKeys?: boolean;
  /** Function to check if provider has valid key */
  hasKey: (providerId: string) => Promise<boolean>;
  /** Get provider display name */
  getProviderName?: (providerId: string) => string;
  /** Currently selected provider */
  selectedProvider?: string;
  /** Callback when provider selected */
  onSelect?: (providerId: string) => void;
  /** Render prop */
  children: (props: {
    providers: ProviderWithKey[];
    selectedProvider?: string;
    isLoading: boolean;
    error?: Error;
    selectProvider: (providerId: string) => void;
    refresh: () => Promise<void>;
  }) => React.ReactNode;
}

/**
 * Headless provider selector component
 */
export function ProviderSelector({
  allProviders = [],
  onlyWithKeys = false,
  hasKey,
  getProviderName,
  selectedProvider,
  onSelect,
  children,
}: ProviderSelectorProps) {
  const [providers, setProviders] = useState<ProviderWithKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    loadProviders();
  }, [allProviders, onlyWithKeys]);

  const loadProviders = async () => {
    if (allProviders.length === 0) {
      setProviders([]);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const providerList: ProviderWithKey[] = await Promise.all(
        allProviders.map(async (id) => {
          const hasValidKey = await hasKey(id);
          return {
            id,
            name: getProviderName ? getProviderName(id) : id,
            hasValidKey,
          };
        })
      );

      // Filter if needed
      const filtered = onlyWithKeys
        ? providerList.filter(p => p.hasValidKey)
        : providerList;

      setProviders(filtered);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load providers'));
    } finally {
      setIsLoading(false);
    }
  };

  const selectProvider = (providerId: string) => {
    if (onSelect) {
      onSelect(providerId);
    }
  };

  const refresh = async () => {
    await loadProviders();
  };

  return (
    <>
      {children({
        providers,
        selectedProvider,
        isLoading,
        error,
        selectProvider,
        refresh,
      })}
    </>
  );
}
