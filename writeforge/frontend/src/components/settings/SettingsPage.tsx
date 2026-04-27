import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { useUISettings } from '@/hooks/useUISettings'
import { Key, Trash2, Plus, Bot, Database, FolderOpen, Save, TestTube, CheckCircle, XCircle, Sun, Moon, Monitor, Type, Heading, Loader, List } from 'lucide-react'

interface AIConfig {
  id: string
  provider: string
  config_type: string
  is_active: boolean
}

interface AIModel {
  id: string
  name: string
  provider: string
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Claude (Anthropic)' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'google', name: 'Google Gemini' },
  { id: 'moonshot', name: 'Kimi (Moonshot)' },
]

const LANGUAGES = [
  { code: 'en-US', name: 'US English' },
  { code: 'en-GB', name: 'UK English' },
  { code: 'en-AU', name: 'Australian English' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
]

export default function SettingsPage() {
  const { settings, setSettings } = useUISettings()
  const [showForm, setShowForm] = useState(false)
  const [provider, setProvider] = useState('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [storageMode, setStorageMode] = useState<'database' | 'obsidian'>('database')
  const [vaultPath, setVaultPath] = useState('')
  const [testResult, setTestResult] = useState<{provider: string; success: boolean; message: string} | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showModels, setShowModels] = useState(false)
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('writeforge-language') || 'en-US'
    }
    return 'en-US'
  })
  const queryClient = useQueryClient()

  useEffect(() => {
    localStorage.setItem('writeforge-language', language)
  }, [language])

  const { data: configs } = useQuery({
    queryKey: ['ai-configs'],
    queryFn: async () => {
      const res = await api.get<AIConfig[]>('/ai-providers/configs')
      return res.data
    },
  })

  const { data: activeModels, isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-active-models'],
    queryFn: async () => {
      const res = await api.get<AIModel[]>('/ai-providers/active-models')
      return res.data
    },
    enabled: showModels,
  })

  const createMutation = useMutation({
    mutationFn: (data: { provider: string; api_key: string }) =>
      api.post('/ai-providers/configs', null, { params: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-configs'] })
      setShowForm(false)
      setApiKey('')
      setSaveError(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to save API key'
      setSaveError(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ai-providers/configs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-configs'] })
    },
  })

  const testMutation = useMutation({
    mutationFn: (provider: string) => api.post(`/ai-providers/test/${provider}`),
    onSuccess: (res) => {
      setTestResult({ provider: res.data.provider, success: res.data.success, message: res.data.message })
      setTestingProvider(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Test failed'
      setTestResult({ provider: testingProvider || '', success: false, message: msg })
      setTestingProvider(null)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaveError(null)
    createMutation.mutate({ provider, api_key: apiKey })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" />
          Settings
        </h1>
      </div>

      <div className="space-y-4 p-4 bg-card rounded-lg border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5" />
          Storage Mode
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose how WriteForge stores your project data.
        </p>
        <div className="flex gap-2 p-1 bg-background rounded-md border">
          <button
            onClick={() => setStorageMode('database')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
              storageMode === 'database'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            }`}
          >
            <Database className="h-4 w-4" />
            Database (SQLite)
          </button>
          <button
            onClick={() => setStorageMode('obsidian')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
              storageMode === 'obsidian'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            Obsidian Vault
          </button>
        </div>
        {storageMode === 'obsidian' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Vault Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={vaultPath}
                onChange={(e) => setVaultPath(e.target.value)}
                placeholder="/path/to/your/obsidian/vault"
                className="flex-1 px-3 py-2 border rounded-md bg-background text-sm"
              />
              <button className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center gap-1">
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              In Obsidian mode, all project data is stored as Markdown files in your vault folder.
              Characters, story bible, manuscripts, and outlines become .md files with YAML frontmatter.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 bg-card rounded-lg border">
        <h2 className="text-lg font-semibold">Writing Language</h2>
        <p className="text-sm text-muted-foreground">
          The language the AI will use when generating or rewriting text.
        </p>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4 p-4 bg-card rounded-lg border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sun className="h-5 w-5" />
          Appearance
        </h2>

        {/* Theme */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Theme</label>
          <div className="flex gap-2">
            {([
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ] as const).map((opt) => {
              const Icon = opt.icon
              const active = settings.theme === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setSettings({ theme: opt.value })}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active ? 'bg-primary text-primary-foreground' : 'bg-background border hover:bg-accent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Font */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            <Type className="h-4 w-4" />
            Font
          </label>
          <select
            value={settings.fontFamily}
            onChange={(e) => setSettings({ fontFamily: e.target.value as any })}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          >
            <option value="sans">Sans-serif (default)</option>
            <option value="serif">Serif (Georgia)</option>
            <option value="mono">Monospace</option>
            <option value="atkinson">Atkinson Hyperlegible</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Applies to the entire app including the editor.
          </p>
        </div>

        {/* Heading size */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            <Heading className="h-4 w-4" />
            Heading Size
          </label>
          <div className="flex gap-2">
            {([
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ] as const).map((opt) => {
              const active = settings.headingSize === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setSettings({ headingSize: opt.value })}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active ? 'bg-primary text-primary-foreground' : 'bg-background border hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Key
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="p-4 bg-card rounded-lg border space-y-3">
            <div>
              <label className="text-sm font-medium">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                required
              />
            </div>
            {saveError && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                {saveError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving...' : 'Save Key'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setSaveError(null) }}
                className="px-4 py-2 border rounded-md text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {configs?.map((config) => (
            <div key={config.id} className="p-3 bg-card rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${config.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <p className="font-medium capitalize">{config.provider}</p>
                    <p className="text-xs text-muted-foreground">{config.config_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setTestResult(null); setTestingProvider(config.provider); testMutation.mutate(config.provider) }}
                    disabled={testMutation.isPending}
                    className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-accent disabled:opacity-50"
                    title="Test connection"
                  >
                    <TestTube className="h-3.5 w-3.5" />
                    {testingProvider === config.provider ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(config.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {testResult?.provider === config.provider && (
                <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {testResult.message}
                </div>
              )}
            </div>
          ))}
          {configs?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No API keys configured yet
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <List className="h-5 w-5" />
            Available Models
          </h2>
          <button
            onClick={() => setShowModels(!showModels)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            {showModels ? 'Hide Models' : 'Show Models for My Keys'}
          </button>
        </div>

        {showModels && (
          <div>
            {modelsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading available models...</span>
              </div>
            ) : activeModels && activeModels.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto">
                {activeModels.map((model) => (
                  <div key={model.id} className="p-3 bg-card rounded-lg border">
                    <p className="font-medium text-sm">{model.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{model.provider}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active API keys configured. Add a key above to see available models.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
