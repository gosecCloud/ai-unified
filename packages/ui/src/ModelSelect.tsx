/**
 * Model selection component (headless)
 */

import React, { useState, useEffect } from 'react';
import type { ModelInfo, ModelKind } from '@aiu/core';

export interface ModelSelectProps {
  /** Available models */
  models: ModelInfo[];
  /** Selected model ID */
  value?: string;
  /** Change handler */
  onChange: (modelId: string, model: ModelInfo) => void;
  /** Filter by model kinds */
  kinds?: ModelKind[];
  /** Filter by provider */
  provider?: string;
  /** Minimum context window */
  minContext?: number;
  /** Exclude deprecated models */
  excludeDeprecated?: boolean;
  /** Render prop */
  children: (props: {
    filteredModels: ModelInfo[];
    selectedModel?: ModelInfo;
    handleSelect: (modelId: string) => void;
  }) => React.ReactNode;
}

/**
 * Headless model selector component
 */
export function ModelSelect({
  models,
  value,
  onChange,
  kinds,
  provider,
  minContext,
  excludeDeprecated = true,
  children,
}: ModelSelectProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(value);

  // Filter models
  const filteredModels = models.filter((model) => {
    if (kinds && !kinds.includes(model.kind)) return false;
    if (provider && model.providerId !== provider) return false;
    if (minContext && (!model.contextWindow || model.contextWindow < minContext)) return false;
    if (excludeDeprecated && model.deprecated) return false;
    return true;
  });

  const selectedModel = filteredModels.find((m) => `${m.providerId}:${m.modelId}` === selectedId);

  const handleSelect = (modelId: string) => {
    setSelectedId(modelId);
    const model = filteredModels.find((m) => `${m.providerId}:${m.modelId}` === modelId);
    if (model) {
      onChange(modelId, model);
    }
  };

  useEffect(() => {
    setSelectedId(value);
  }, [value]);

  return <>{children({ filteredModels, selectedModel, handleSelect })}</>;
}
