'use client';

import { useState, useEffect } from 'react';
import { ModelForm, type ModelFormData } from '@aiu/ui';
import type { ModelInfo } from '@aiu/core';

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  azure: 'Azure',
  cohere: 'Cohere',
  ollama: 'Ollama',
  mistral: 'Mistral AI',
  stability: 'Stability AI',
  elevenlabs: 'ElevenLabs',
  assemblyai: 'AssemblyAI',
  jina: 'Jina AI',
  openrouter: 'OpenRouter',
  vllm: 'vLLM',
};

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [filteredModels, setFilteredModels] = useState<ModelInfo[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedKind, setSelectedKind] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadModels();
    loadProviders();
  }, []);

  useEffect(() => {
    filterModels();
  }, [models, selectedProvider, selectedKind, searchQuery]);

  const loadProviders = async () => {
    try {
      const response = await fetch('/api/keys');
      const data = await response.json();
      const providers = data.keys.map((k: any) => k.providerId);
      setAvailableProviders(providers);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const loadModels = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterModels = () => {
    let filtered = models;

    if (selectedProvider !== 'all') {
      filtered = filtered.filter(m => m.providerId === selectedProvider);
    }

    if (selectedKind !== 'all') {
      filtered = filtered.filter(m => m.kind === selectedKind);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        m =>
          m.modelId.toLowerCase().includes(query) ||
          m.providerId.toLowerCase().includes(query)
      );
    }

    setFilteredModels(filtered);
  };

  const handleProviderSelect = async (providerId: string): Promise<ModelInfo[]> => {
    try {
      const response = await fetch(`/api/models/list?providerId=${providerId}`);
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      throw error;
    }
  };

  const handleAddModel = async (model: ModelInfo) => {
    const response = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add model');
    }

    // Refresh models list
    await loadModels();
    setShowAddForm(false);
  };

  const handleValidateModel = async (data: ModelFormData) => {
    const errors: Record<string, string> = {};

    // Check for duplicates
    const exists = models.some(
      m => m.providerId === data.providerId && m.modelId === data.modelId
    );

    if (exists) {
      errors.modelId = 'This model already exists';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };
  };

  const providers = Array.from(new Set(models.map(m => m.providerId)));
  const kinds = Array.from(new Set(models.map(m => m.kind)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Model Registry</h2>
          <p className="text-gray-600 mt-2">
            Browse and manage AI models from multiple providers
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          {showAddForm ? 'Cancel' : '+ Add Model'}
        </button>
      </div>

      {/* Add Model Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Model</h3>
          <ModelForm
            availableProviders={availableProviders}
            onProviderSelect={handleProviderSelect}
            onSave={handleAddModel}
            onValidate={handleValidateModel}
            onCancel={() => setShowAddForm(false)}
          >
            {({
              formData,
              errors,
              isLoadingModels,
              availableProviders,
              availableModels,
              selectedModel,
              handleProviderChange,
              handleModelSelect,
              handleChange,
              handleModalityToggle,
              handleSave,
              handleReset,
              canSave,
            }) => (
              <div className="space-y-4">
                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider *
                  </label>
                  <select
                    value={formData.providerId}
                    onChange={e => handleProviderChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.providerId ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select provider</option>
                    {availableProviders.length === 0 ? (
                      <option disabled>No API keys configured</option>
                    ) : (
                      availableProviders.map(id => (
                        <option key={id} value={id}>
                          {PROVIDER_NAMES[id] || id}
                        </option>
                      ))
                    )}
                  </select>
                  {errors.providerId && (
                    <p className="text-red-500 text-sm mt-1">{errors.providerId}</p>
                  )}
                  {availableProviders.length === 0 && (
                    <p className="text-yellow-600 text-sm mt-1">
                      ⚠️ No API keys found. Please add keys in{' '}
                      <a href="/keyring" className="underline">
                        Keyring Manager
                      </a>
                      .
                    </p>
                  )}
                </div>

                {/* Model Selection */}
                {formData.providerId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model *
                    </label>
                    {isLoadingModels ? (
                      <div className="text-gray-500 text-sm py-2">Loading models...</div>
                    ) : availableModels.length > 0 ? (
                      <select
                        value={formData.modelId}
                        onChange={e => handleModelSelect(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.modelId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select model</option>
                        {availableModels.map(model => (
                          <option key={model.modelId} value={model.modelId}>
                            {model.modelId} ({model.kind})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.modelId}
                        onChange={e => handleChange('modelId', e.target.value)}
                        placeholder="Enter model ID manually"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.modelId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                    )}
                    {errors.modelId && (
                      <p className="text-red-500 text-sm mt-1">{errors.modelId}</p>
                    )}
                  </div>
                )}

                {/* Model Details (auto-populated or manual) */}
                {formData.modelId && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kind *
                        </label>
                        <select
                          value={formData.kind}
                          onChange={e => handleChange('kind', e.target.value)}
                          disabled={!!selectedModel}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                          <option value="chat">Chat</option>
                          <option value="embed">Embedding</option>
                          <option value="image">Image</option>
                          <option value="audio">Audio</option>
                          <option value="rerank">Rerank</option>
                          <option value="tool">Tool</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Context Window
                        </label>
                        <input
                          type="number"
                          value={formData.contextWindow || ''}
                          onChange={e =>
                            handleChange('contextWindow', parseInt(e.target.value) || undefined)
                          }
                          disabled={!!selectedModel}
                          placeholder="128000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Output Tokens
                        </label>
                        <input
                          type="number"
                          value={formData.maxOutputTokens || ''}
                          onChange={e =>
                            handleChange('maxOutputTokens', parseInt(e.target.value) || undefined)
                          }
                          disabled={!!selectedModel}
                          placeholder="4096"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Modalities *
                        </label>
                        <div className="flex items-center space-x-4 pt-2">
                          {(['text', 'image', 'audio'] as const).map(modality => (
                            <label key={modality} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.modalities.includes(modality)}
                                onChange={() => handleModalityToggle(modality)}
                                disabled={!!selectedModel}
                                className="rounded disabled:opacity-50"
                              />
                              <span className="text-sm capitalize">{modality}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cost per Input Token (USD)
                        </label>
                        <input
                          type="number"
                          step="0.0000001"
                          value={formData.costPerInputToken || ''}
                          onChange={e =>
                            handleChange('costPerInputToken', parseFloat(e.target.value) || undefined)
                          }
                          disabled={!!selectedModel}
                          placeholder="0.00003"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cost per Output Token (USD)
                        </label>
                        <input
                          type="number"
                          step="0.0000001"
                          value={formData.costPerOutputToken || ''}
                          onChange={e =>
                            handleChange('costPerOutputToken', parseFloat(e.target.value) || undefined)
                          }
                          disabled={!!selectedModel}
                          placeholder="0.00006"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="deprecated"
                        checked={formData.deprecated}
                        onChange={e => handleChange('deprecated', e.target.checked)}
                        disabled={!!selectedModel}
                        className="rounded disabled:opacity-50"
                      />
                      <label htmlFor="deprecated" className="text-sm text-gray-700">
                        Mark as deprecated
                      </label>
                    </div>

                    {selectedModel && (
                      <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
                        ℹ️ Model details auto-populated from provider. Fields are read-only.
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add Model
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </ModelForm>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={selectedProvider}
          onChange={e => setSelectedProvider(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Providers</option>
          {providers.map(provider => (
            <option key={provider} value={provider}>
              {PROVIDER_NAMES[provider] || provider}
            </option>
          ))}
        </select>
        <select
          value={selectedKind}
          onChange={e => setSelectedKind(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {kinds.map(kind => (
            <option key={kind} value={kind}>
              {kind.charAt(0).toUpperCase() + kind.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            Loading models...
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            <p className="text-lg">No models found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filteredModels.map(model => (
            <div
              key={`${model.providerId}:${model.modelId}`}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {model.modelId}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {PROVIDER_NAMES[model.providerId] || model.providerId}
                  </p>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  {model.kind}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {model.contextWindow && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Context:</span>
                    <span className="font-medium text-gray-900">
                      {model.contextWindow.toLocaleString()} tokens
                    </span>
                  </div>
                )}
                {model.modalities && model.modalities.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Modalities:</span>
                    <span className="font-medium text-gray-900">
                      {model.modalities.join(', ')}
                    </span>
                  </div>
                )}
                {model.costPerInputToken !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Input cost:</span>
                    <span className="font-medium text-gray-900">
                      ${model.costPerInputToken.toFixed(7)}/token
                    </span>
                  </div>
                )}
              </div>

              {model.deprecated && (
                <div className="mt-3 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                  ⚠️ Deprecated
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>
            Showing {filteredModels.length} of {models.length} models
          </span>
          <span>{providers.length} providers</span>
        </div>
      </div>
    </div>
  );
}
