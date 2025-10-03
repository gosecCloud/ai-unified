/**
 * Model form component (headless)
 */

import React, { useState } from 'react';
import type { ModelInfo, ModelKind, Modality } from '@aiu/core';

export interface ModelFormData {
  providerId: string;
  modelId: string;
  kind: ModelKind;
  contextWindow?: number;
  maxOutputTokens?: number;
  modalities: Modality[];
  deprecated: boolean;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export interface ModelFormProps {
  /** Initial values */
  initialValues?: Partial<ModelFormData>;
  /** Available providers (from keyring) */
  availableProviders?: string[];
  /** Callback when provider selected - returns available models */
  onProviderSelect?: (providerId: string) => Promise<ModelInfo[]>;
  /** Callback when model selected from dropdown */
  onModelSelect?: (model: ModelInfo) => void;
  /** Validation function */
  onValidate?: (data: ModelFormData) => Promise<{ valid: boolean; errors?: Record<string, string> }>;
  /** Save function */
  onSave: (model: ModelInfo) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Render prop */
  children: (props: {
    formData: ModelFormData;
    errors: Record<string, string>;
    isValidating: boolean;
    isSaving: boolean;
    isLoadingModels: boolean;
    error?: Error;
    availableProviders: string[];
    availableModels: ModelInfo[];
    selectedModel?: ModelInfo;
    handleChange: (field: keyof ModelFormData, value: any) => void;
    handleModalityToggle: (modality: Modality) => void;
    handleProviderChange: (providerId: string) => Promise<void>;
    handleModelSelect: (modelId: string) => void;
    handleValidate: () => Promise<boolean>;
    handleSave: () => Promise<void>;
    handleReset: () => void;
    canSave: boolean;
  }) => React.ReactNode;
}

const defaultFormData: ModelFormData = {
  providerId: '',
  modelId: '',
  kind: 'chat',
  modalities: ['text'],
  deprecated: false,
};

/**
 * Headless model form component
 */
export function ModelForm({
  initialValues,
  availableProviders = [],
  onProviderSelect,
  onModelSelect,
  onValidate,
  onSave,
  onCancel,
  children,
}: ModelFormProps) {
  const [formData, setFormData] = useState<ModelFormData>({
    ...defaultFormData,
    ...initialValues,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [error, setError] = useState<Error>();
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo>();

  const handleChange = (field: keyof ModelFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleModalityToggle = (modality: Modality) => {
    setFormData(prev => {
      const modalities = prev.modalities.includes(modality)
        ? prev.modalities.filter(m => m !== modality)
        : [...prev.modalities, modality];
      return { ...prev, modalities };
    });
  };

  const handleProviderChange = async (providerId: string) => {
    setFormData(prev => ({
      ...prev,
      providerId,
      modelId: '', // Reset model when provider changes
    }));
    setSelectedModel(undefined);
    setAvailableModels([]);

    if (onProviderSelect && providerId) {
      setIsLoadingModels(true);
      setError(undefined);
      try {
        const models = await onProviderSelect(providerId);
        setAvailableModels(models);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load models'));
      } finally {
        setIsLoadingModels(false);
      }
    }
  };

  const handleModelSelect = (modelId: string) => {
    const model = availableModels.find(m => m.modelId === modelId);

    if (model) {
      setSelectedModel(model);

      // Auto-populate form with model details
      setFormData(prev => ({
        ...prev,
        modelId: model.modelId,
        kind: model.kind,
        contextWindow: model.contextWindow,
        maxOutputTokens: model.maxOutputTokens,
        modalities: model.modalities || ['text'],
        deprecated: model.deprecated || false,
        costPerInputToken: model.costPerInputToken,
        costPerOutputToken: model.costPerOutputToken,
      }));

      if (onModelSelect) {
        onModelSelect(model);
      }
    }
  };

  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!formData.providerId) {
      newErrors.providerId = 'Provider is required';
    }

    if (!formData.modelId) {
      newErrors.modelId = 'Model ID is required';
    }

    if (!formData.kind) {
      newErrors.kind = 'Model kind is required';
    }

    if (formData.modalities.length === 0) {
      newErrors.modalities = 'At least one modality is required';
    }

    if (formData.contextWindow !== undefined && formData.contextWindow < 0) {
      newErrors.contextWindow = 'Context window must be non-negative';
    }

    if (formData.maxOutputTokens !== undefined && formData.maxOutputTokens < 0) {
      newErrors.maxOutputTokens = 'Max output tokens must be non-negative';
    }

    if (formData.costPerInputToken !== undefined && formData.costPerInputToken < 0) {
      newErrors.costPerInputToken = 'Cost must be non-negative';
    }

    if (formData.costPerOutputToken !== undefined && formData.costPerOutputToken < 0) {
      newErrors.costPerOutputToken = 'Cost must be non-negative';
    }

    return newErrors;
  };

  const handleValidate = async (): Promise<boolean> => {
    setIsValidating(true);
    setError(undefined);

    try {
      // Client-side validation
      const clientErrors = validateForm();

      if (Object.keys(clientErrors).length > 0) {
        setErrors(clientErrors);
        return false;
      }

      // Custom validation
      if (onValidate) {
        const result = await onValidate(formData);
        if (!result.valid && result.errors) {
          setErrors(result.errors);
          return false;
        }
        if (!result.valid) {
          setError(new Error('Validation failed'));
          return false;
        }
      }

      setErrors({});
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Validation failed'));
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    // Validate first
    const isValid = await handleValidate();
    if (!isValid) return;

    setIsSaving(true);
    setError(undefined);

    try {
      const model: ModelInfo = {
        providerId: formData.providerId,
        modelId: formData.modelId,
        kind: formData.kind,
        contextWindow: formData.contextWindow,
        maxOutputTokens: formData.maxOutputTokens,
        modalities: formData.modalities,
        deprecated: formData.deprecated,
        costPerInputToken: formData.costPerInputToken,
        costPerOutputToken: formData.costPerOutputToken,
      };

      await onSave(model);

      // Reset form on success
      handleReset();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Save failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({ ...defaultFormData, ...initialValues });
    setErrors({});
    setError(undefined);
    if (onCancel) {
      onCancel();
    }
  };

  const canSave = formData.providerId !== '' && formData.modelId !== '' && !isValidating && !isSaving;

  return (
    <>
      {children({
        formData,
        errors,
        isValidating,
        isSaving,
        isLoadingModels,
        error,
        availableProviders,
        availableModels,
        selectedModel,
        handleChange,
        handleModalityToggle,
        handleProviderChange,
        handleModelSelect,
        handleValidate,
        handleSave,
        handleReset,
        canSave,
      })}
    </>
  );
}
