'use client';

import { KeyringManager, type ApiKeyInfo, type ValidationResult } from '@aiu/ui';
import { useState } from 'react';

// All supported providers
const ALL_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'azure',
  'cohere',
  'ollama',
  'mistral',
  'stability',
  'elevenlabs',
  'assemblyai',
  'jina',
  'openrouter',
  'vllm',
];

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

export default function KeyringPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState({ providerId: '', key: '', alias: '' });

  // API handlers
  const handleLoadKeys = async (): Promise<ApiKeyInfo[]> => {
    const response = await fetch('/api/keys');
    const data = await response.json();
    return data.keys.map((k: any) => ({
      ...k,
      createdAt: new Date(k.createdAt),
    }));
  };

  const handleAddKey = async (providerId: string, key: string, alias: string) => {
    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, key, alias }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add key');
    }
  };

  const handleValidateKey = async (
    providerId: string,
    key: string
  ): Promise<ValidationResult> => {
    // Simulate validation - in real app, this would call provider API
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      valid: key.length > 10,
      reason: key.length > 10 ? undefined : 'Key is too short',
      scopes: ['chat', 'embed'],
    };
  };

  const handleDeleteKey = async (alias: string) => {
    const response = await fetch(`/api/keys?alias=${alias}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete key');
    }
  };

  return (
    <div className="space-y-6">
      <KeyringManager
        onLoadKeys={handleLoadKeys}
        onAddKey={handleAddKey}
        onValidateKey={handleValidateKey}
        onDeleteKey={handleDeleteKey}
      >
        {({ keys, isLoading, isAdding, addKey, deleteKey, error: managerError }) => (
          <>
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Keyring Manager</h2>
                <p className="text-gray-600 mt-2">
                  Secure API key management with encryption and validation
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                disabled={isAdding}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {showAddForm ? 'Cancel' : '+ Add Key'}
              </button>
            </div>

            {/* Global Error */}
            {managerError && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <p className="text-red-800 text-sm">{managerError.message}</p>
              </div>
            )}

            {/* Add Key Form */}
            {showAddForm && (
              <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Add New API Key</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alias
                    </label>
                    <input
                      type="text"
                      value={newKey.alias}
                      onChange={e => setNewKey({ ...newKey, alias: e.target.value })}
                      placeholder="e.g., production, development"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider
                    </label>
                    <select
                      value={newKey.providerId}
                      onChange={e =>
                        setNewKey({ ...newKey, providerId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select provider</option>
                      {ALL_PROVIDERS.map(id => (
                        <option key={id} value={id}>
                          {PROVIDER_NAMES[id]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={newKey.key}
                    onChange={e => setNewKey({ ...newKey, key: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                  <span>🔒</span>
                  <span>Keys are encrypted before storage using AES-256-GCM</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await addKey(newKey.providerId, newKey.key, newKey.alias);
                      setNewKey({ providerId: '', key: '', alias: '' });
                      setShowAddForm(false);
                    } catch (err) {
                      // Error handled by KeyringManager
                    }
                  }}
                  disabled={
                    isAdding || !newKey.alias || !newKey.providerId || !newKey.key
                  }
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isAdding ? 'Adding...' : 'Add Key'}
                </button>
              </div>
            )}

            {/* Keys List */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 px-6 py-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Stored Keys ({keys.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-200">
                {isLoading ? (
                  <div className="p-12 text-center text-gray-400">
                    <p className="text-lg">Loading keys...</p>
                  </div>
                ) : keys.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <p className="text-lg">No API keys stored</p>
                    <p className="text-sm mt-1">Add your first key to get started</p>
                  </div>
                ) : (
                  keys.map(key => (
                    <div
                      key={key.alias}
                      className="p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">
                              {key.alias}
                            </h4>
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                              {PROVIDER_NAMES[key.providerId] || key.providerId}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                key.valid
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {key.valid ? '✓ Valid' : '✗ Invalid'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-gray-500">Scopes:</span>
                              <p className="font-medium text-gray-900">
                                {key.scopes && key.scopes.length > 0
                                  ? key.scopes.join(', ')
                                  : 'None'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Created:</span>
                              <p className="font-medium text-gray-900">
                                {key.createdAt.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={async () => {
                              if (confirm(`Delete key "${key.alias}"?`)) {
                                try {
                                  await deleteKey(key.alias);
                                } catch (err) {
                                  // Error handled by KeyringManager
                                }
                              }
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Security Features */}
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                KeyringManager Component Features
              </h3>
              <ul className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span>AES-256-GCM encryption</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span>Real-time key validation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span>Provider scope detection</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span>Secure key storage</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span>All 13 providers supported</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span>Headless UI pattern</span>
                </li>
              </ul>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <span className="text-yellow-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-yellow-900 mb-1">
                    Security Best Practices
                  </h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Never commit API keys to version control</li>
                    <li>• Rotate keys regularly (recommended: every 90 days)</li>
                    <li>• Use different keys for development and production</li>
                    <li>
                      • Monitor key usage and set up alerts for suspicious activity
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </KeyringManager>
    </div>
  );
}
