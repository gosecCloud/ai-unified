/**
 * Provider API key form component (headless)
 */

import React, { useState } from 'react';

export interface ProviderKeyFormProps {
  /** Provider ID */
  providerId: string;
  /** Validation function */
  onValidate: (key: string) => Promise<{ valid: boolean; reason?: string }>;
  /** Save function */
  onSave: (key: string, alias: string) => Promise<void>;
  /** Default alias */
  defaultAlias?: string;
  /** Render prop */
  children: (props: {
    apiKey: string;
    alias: string;
    isValidating: boolean;
    isSaving: boolean;
    validationResult?: { valid: boolean; reason?: string };
    error?: Error;
    handleKeyChange: (key: string) => void;
    handleAliasChange: (alias: string) => void;
    handleValidate: () => Promise<void>;
    handleSave: () => Promise<void>;
  }) => React.ReactNode;
}

/**
 * Headless provider key form component
 */
export function ProviderKeyForm({
  onValidate,
  onSave,
  defaultAlias = 'default',
  children,
}: ProviderKeyFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [alias, setAlias] = useState(defaultAlias);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; reason?: string }>();
  const [error, setError] = useState<Error>();

  const handleValidate = async () => {
    if (!apiKey) return;

    setIsValidating(true);
    setError(undefined);

    try {
      const result = await onValidate(apiKey);
      setValidationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Validation failed'));
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey || !validationResult?.valid) return;

    setIsSaving(true);
    setError(undefined);

    try {
      await onSave(apiKey, alias);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Save failed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {children({
        apiKey,
        alias,
        isValidating,
        isSaving,
        validationResult,
        error,
        handleKeyChange: setApiKey,
        handleAliasChange: setAlias,
        handleValidate,
        handleSave,
      })}
    </>
  );
}
