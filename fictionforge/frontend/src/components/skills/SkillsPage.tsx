import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import {
  Plus, Wand2, Trash2, Copy, Lock, Unlock,
  Loader2, Zap, ArrowRight, Type, Feather,
  BookOpen, Check, RefreshCw, Sparkles, ScrollText,
  Pen, Pencil, Highlighter, Search, Globe, Brain, Eye,
  MessageSquare, List, ListOrdered, FileText, Heart,
  Star, Flame, Moon, Sun, Cloud, TreePine, Mountain,
  Anchor, Sword, Shield, Crown, Gem, Key, Braces
} from 'lucide-react'
import ResizablePanel from '@/components/shared/ResizablePanel'

interface Skill {
  id: string
  name: string
  description: string | null
  category: string
  prompt_template: string
  system_prompt: string | null
  variables: string | null
  example_input: string | null
  example_output: string | null
  action: string | null
  context_sources: string | null
  specific_documents: string | null
  cross_skill_refs: string | null
  is_agentic: boolean
  is_locked: boolean
  is_quick_action: boolean
  icon: string | null
  temperature: number | null
  model: string | null
}

const CATEGORIES = ['writing', 'style', 'worldbuilding', 'character', 'dialogue', 'plot', 'agentic', 'orchestrator', 'custom']

const AVAILABLE_ICONS = [
  { name: 'ArrowRight', label: 'Arrow Right' },
  { name: 'RefreshCw', label: 'Refresh' },
  { name: 'Type', label: 'Type' },
  { name: 'Zap', label: 'Zap' },
  { name: 'Sparkles', label: 'Sparkles' },
  { name: 'Feather', label: 'Feather' },
  { name: 'BookOpen', label: 'Book Open' },
  { name: 'ScrollText', label: 'Scroll' },
  { name: 'Wand2', label: 'Wand' },
  { name: 'Pen', label: 'Pen' },
  { name: 'Pencil', label: 'Pencil' },
  { name: 'Highlighter', label: 'Highlighter' },
  { name: 'Search', label: 'Search' },
  { name: 'Globe', label: 'Globe' },
  { name: 'Brain', label: 'Brain' },
  { name: 'Eye', label: 'Eye' },
  { name: 'MessageSquare', label: 'Message' },
  { name: 'List', label: 'List' },
  { name: 'ListOrdered', label: 'Ordered List' },
  { name: 'FileText', label: 'File' },
  { name: 'Heart', label: 'Heart' },
  { name: 'Star', label: 'Star' },
  { name: 'Flame', label: 'Flame' },
  { name: 'Moon', label: 'Moon' },
  { name: 'Sun', label: 'Sun' },
  { name: 'Cloud', label: 'Cloud' },
  { name: 'TreePine', label: 'Tree' },
  { name: 'Mountain', label: 'Mountain' },
  { name: 'Anchor', label: 'Anchor' },
  { name: 'Sword', label: 'Sword' },
  { name: 'Shield', label: 'Shield' },
  { name: 'Crown', label: 'Crown' },
  { name: 'Gem', label: 'Gem' },
  { name: 'Key', label: 'Key' },
  { name: 'Lock', label: 'Lock' },
  { name: 'Unlock', label: 'Unlock' },
]

const CONTEXT_SOURCE_OPTIONS = [
  { id: 'style_guide', label: 'Style Guide' },
  { id: 'characters', label: 'Characters' },
  { id: 'story_bible', label: 'Story Bible' },
  { id: 'outlines', label: 'Outlines / Story Plan' },
  { id: 'documents', label: 'Documents / Chapters' },
]

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  writing: Feather,
  style: BookOpen,
  worldbuilding: BookOpen,
  character: UserIcon,
  dialogue: Type,
  plot: ArrowRight,
  agentic: Zap,
  orchestrator: BookOpen,
  custom: Wand2,
}

function UserIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

const QUICK_ACTION_ICON_MAP: Record<string, React.ElementType> = {
  ArrowRight, RefreshCw, Type, Zap, Sparkles, Feather, BookOpen,
  ScrollText, Wand2, Pen, Pencil, Highlighter, Search, Globe,
  Brain, Eye, MessageSquare, List, ListOrdered, FileText, Heart,
  Star, Flame, Moon, Sun, Cloud, TreePine, Mountain, Anchor,
  Sword, Shield, Crown, Gem, Key, Lock, Unlock,
}

function QuickActionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = QUICK_ACTION_ICON_MAP[name] || Wand2
  return <Icon className={className} />
}

const AVAILABLE_VARIABLES = [
  { name: '{{text}}', desc: 'Selected text or user input' },
  { name: '{{fullContext}}', desc: 'Full project context (documents, characters, story bible, etc.)' },
  { name: '{{title}}', desc: 'Project title' },
  { name: '{{description}}', desc: 'Project description' },
  { name: '{{documentType}}', desc: 'Current document type (e.g., chapter, story_bible)' },
  { name: '{{fieldName}}', desc: 'Current field name being edited' },
  { name: '{{document_title}}', desc: 'Title/name of the currently selected document (blank if nothing selected)' },
  { name: '{{module}}', desc: 'Name of the module the AI is being called from (e.g., Writing, Story Bible, Characters, Story Plan, Notes, Style)' },
]

function VariableTipButton({ onInsert }: { onInsert: (variable: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent text-muted-foreground border border-transparent hover:border-border transition-colors"
        title="Insert variable"
      >
        <Braces className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 right-0 mt-1 w-64 bg-card border rounded-lg shadow-lg py-1">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">
              Available Variables
            </div>
            {AVAILABLE_VARIABLES.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => { onInsert(v.name); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex flex-col"
              >
                <code className="font-mono text-primary">{v.name}</code>
                <span className="text-muted-foreground">{v.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function SkillsPage() {
  const [showForm, setShowForm] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [editingOverride, setEditingOverride] = useState(false)
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<Skill>>({
    name: '', description: '', category: 'writing', prompt_template: '',
    system_prompt: '', variables: '{}', example_input: '', example_output: '',
    action: '', context_sources: '[]', specific_documents: '[]',
    cross_skill_refs: '[]', is_agentic: false, is_locked: false,
    is_quick_action: false, icon: '',
    temperature: 0.8, model: ''
  })

  const createSystemRef = useRef<HTMLTextAreaElement>(null)
  const createPromptRef = useRef<HTMLTextAreaElement>(null)

  const insertIntoFormField = (field: 'system_prompt' | 'prompt_template', text: string) => {
    const ref = field === 'system_prompt' ? createSystemRef : createPromptRef
    const el = ref.current
    if (!el) {
      setFormData((prev) => ({
        ...prev,
        [field]: (prev[field] || '') + text
      }))
      return
    }
    const prev = formData[field] || ''
    const start = el.selectionStart ?? prev.length
    const next = prev.slice(0, start) + text + prev.slice(el.selectionEnd ?? start)
    setFormData((f) => ({ ...f, [field]: next }))
    requestAnimationFrame(() => {
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
      el.focus()
    })
  }

  const { data: skills, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await api.get<Skill[]>('/skills')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Skill>) => api.post('/skills', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      setShowForm(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Skill> }) =>
      api.put(`/skills/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      setSelectedSkill(null)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: (skill: Skill) => api.post('/skills', {
      ...skill,
      name: `${skill.name} (Copy)`,
      is_locked: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })

  const resetForm = () => {
    setFormData({
      name: '', description: '', category: 'writing', prompt_template: '',
      system_prompt: '', variables: '{}', example_input: '', example_output: '',
      action: '', context_sources: '[]', specific_documents: '[]',
      cross_skill_refs: '[]', is_agentic: false, is_locked: false,
      is_quick_action: false, icon: '',
      temperature: 0.8, model: ''
    })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name?.trim() || !formData.prompt_template?.trim()) return
    createMutation.mutate(formData)
  }

  const handleUpdate = (updates: Partial<Skill>) => {
    if (!selectedSkill) return
    const merged = { ...selectedSkill, ...updates }
    updateMutation.mutate({ id: selectedSkill.id, data: merged })
    setSelectedSkill(merged as Skill)
  }

  const toggleLock = () => {
    if (!selectedSkill) return
    handleUpdate({ is_locked: !selectedSkill.is_locked })
  }

  const toggleAgentic = () => {
    if (!selectedSkill) return
    handleUpdate({ is_agentic: !selectedSkill.is_agentic })
  }

  const parseContextSources = (s: string | null): string[] => {
    try { return JSON.parse(s || '[]') } catch { return [] }
  }

  const parseCrossSkillRefs = (s: string | null): string[] => {
    try { return JSON.parse(s || '[]') } catch { return [] }
  }

  const toggleContextSource = (source: string) => {
    if (!selectedSkill) return
    const current = parseContextSources(selectedSkill.context_sources)
    const next = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source]
    handleUpdate({ context_sources: JSON.stringify(next) })
  }

  const handleTestSkill = async () => {
    if (!selectedSkill) return
    setTestLoading(true)
    try {
      const res = await api.post(`/skills/${selectedSkill.id}/apply`, {
        context: { text: testInput, fullContext: testInput }
      })
      setTestResult(res.data.rendered_prompt)
    } catch (err: any) {
      setTestResult(`Error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setTestLoading(false)
    }
  }

  const isEditing = selectedSkill && (!selectedSkill.is_locked || editingOverride)

  useEffect(() => {
    setEditingOverride(false)
  }, [selectedSkill?.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="h-6 w-6" />
            Agents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define reusable agentic prompts, context sources, and workflows
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setSelectedSkill(null) }}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 bg-card rounded-lg border space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Agent name"
              className="px-3 py-2 border rounded-md bg-background"
              required
            />
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="px-3 py-2 border rounded-md bg-background"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <input
              value={formData.action || ''}
              onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              placeholder="Action (e.g. continue, rewrite, outline_plan)"
              className="px-3 py-2 border rounded-md bg-background"
            />
          </div>
          <input
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description"
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">System Prompt</span>
              <VariableTipButton onInsert={(v) => insertIntoFormField('system_prompt', v)} />
            </div>
            <textarea
              ref={createSystemRef}
              value={formData.system_prompt || ''}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              placeholder="System prompt (sent to AI as system message)"
              className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px] font-mono text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Prompt Template</span>
            </div>
            <div className="relative">
              <textarea
                ref={createPromptRef}
                value={formData.prompt_template || ''}
                onChange={(e) => setFormData({ ...formData, prompt_template: e.target.value })}
                placeholder="Prompt template (use {{variable}} syntax)"
                className="w-full px-3 py-2 pr-10 border rounded-md bg-background min-h-[80px] font-mono text-sm"
                required
              />
              <div className="absolute top-1.5 right-1.5">
                <VariableTipButton onInsert={(v) => insertIntoFormField('prompt_template', v)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={formData.variables || '{}'}
              onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
              placeholder='Variables JSON'
              className="px-3 py-2 border rounded-md bg-background font-mono text-sm"
            />
            <input
              value={formData.model || ''}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder="Model override (optional)"
              className="px-3 py-2 border rounded-md bg-background font-mono text-sm"
            />
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={formData.temperature ?? 0.8}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              placeholder="Temperature"
              className="px-3 py-2 border rounded-md bg-background"
            />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.is_agentic || false}
                onChange={(e) => setFormData({ ...formData, is_agentic: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Agentic
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.is_quick_action || false}
                onChange={(e) => setFormData({ ...formData, is_quick_action: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Quick Action
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.is_locked || false}
                onChange={(e) => setFormData({ ...formData, is_locked: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Locked
            </label>
            {(formData.is_quick_action || false) && (
              <select
                value={formData.icon || ''}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="px-2 py-1 border rounded-md bg-background text-sm"
              >
                <option value="">Select icon...</option>
                {AVAILABLE_ICONS.map((ic) => (
                  <option key={ic.name} value={ic.name}>{ic.label}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
              Create Agent
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-280px)]">
        {/* Agent list */}
        <ResizablePanel side="left" defaultWidth={220} storageKey="skills_left">
          <div className="p-4 h-full overflow-auto">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Agents
            </h2>
            <div className="space-y-1">
              {skills?.map((skill) => {
                const Icon = CATEGORY_ICONS[skill.category] || Wand2
                return (
                  <div
                    key={skill.id}
                    className={`flex items-center gap-1 p-2 rounded-md cursor-pointer hover:bg-accent ${
                      selectedSkill?.id === skill.id ? 'bg-accent ring-1 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedSkill(skill)}
                  >
                    {skill.is_quick_action && skill.icon ? (
                      <QuickActionIcon name={skill.icon} className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1 text-sm truncate">{skill.name}</span>
                    {skill.is_locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                    {skill.is_agentic && <Zap className="h-3 w-3 text-yellow-500 shrink-0" />}
                    {skill.is_quick_action && <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full shrink-0">QA</span>}
                  </div>
                )
              })}
              {skills?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No agents yet</p>
              )}
            </div>
          </div>
        </ResizablePanel>

        {/* Detail / Editor */}
        <div className="flex-1 min-w-0 bg-card rounded-lg border flex flex-col overflow-hidden">
          {selectedSkill ? (
            <div className="flex flex-col h-full overflow-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b shrink-0">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs px-2 py-0.5 bg-secondary rounded-full uppercase tracking-wider">
                    {selectedSkill.category}
                  </span>
                  {selectedSkill.is_locked && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full uppercase tracking-wider dark:bg-red-900/30 dark:text-red-400">
                      Locked
                    </span>
                  )}
                  {selectedSkill.is_quick_action && (
                    <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full uppercase tracking-wider">
                      Quick Action
                    </span>
                  )}
                  {selectedSkill.is_agentic && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full uppercase tracking-wider dark:bg-yellow-900/30 dark:text-yellow-400">
                      Agentic
                    </span>
                  )}
                  <input
                    value={selectedSkill.name}
                    onChange={(e) => isEditing && handleUpdate({ name: e.target.value })}
                    disabled={!isEditing}
                    className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 flex-1 disabled:opacity-60"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {selectedSkill.is_locked && (
                    <button
                      onClick={() => setEditingOverride(!editingOverride)}
                      className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-accent"
                      title={editingOverride ? 'Lock editing' : 'Unlock editing'}
                    >
                      {editingOverride ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {editingOverride ? 'Unlocked' : 'Unlock'}
                    </button>
                  )}
                  <button
                    onClick={() => duplicateMutation.mutate(selectedSkill)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-accent"
                    title="Duplicate agent"
                  >
                    <Copy className="h-3 w-3" />
                    Duplicate
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(selectedSkill.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Basic info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select
                      value={selectedSkill.category}
                      onChange={(e) => isEditing && handleUpdate({ category: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border rounded-md bg-background text-sm mt-1 disabled:opacity-60"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Action</label>
                    <input
                      value={selectedSkill.action || ''}
                      onChange={(e) => isEditing && handleUpdate({ action: e.target.value })}
                      disabled={!isEditing}
                      placeholder="e.g. outline_plan"
                      className="w-full px-3 py-2 border rounded-md bg-background text-sm mt-1 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Model Override</label>
                    <input
                      value={selectedSkill.model || ''}
                      onChange={(e) => isEditing && handleUpdate({ model: e.target.value })}
                      disabled={!isEditing}
                      placeholder="e.g. gpt-4o"
                      className="w-full px-3 py-2 border rounded-md bg-background text-sm mt-1 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <input
                    value={selectedSkill.description || ''}
                    onChange={(e) => isEditing && handleUpdate({ description: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm mt-1 disabled:opacity-60"
                  />
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSkill.is_agentic}
                      onChange={() => isEditing && toggleAgentic()}
                      disabled={!isEditing}
                      className="h-4 w-4 rounded border-gray-300 disabled:opacity-60"
                    />
                    Agentic (fetches project context)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSkill.is_locked}
                      onChange={() => isEditing && toggleLock()}
                      disabled={!isEditing}
                      className="h-4 w-4 rounded border-gray-300 disabled:opacity-60"
                    />
                    Locked
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={selectedSkill.temperature ?? 0.8}
                      onChange={(e) => isEditing && handleUpdate({ temperature: parseFloat(e.target.value) })}
                      disabled={!isEditing}
                      className="w-20 px-2 py-1 border rounded-md bg-background text-sm disabled:opacity-60"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSkill.is_quick_action}
                      onChange={() => isEditing && handleUpdate({ is_quick_action: !selectedSkill.is_quick_action })}
                      disabled={!isEditing}
                      className="h-4 w-4 rounded border-gray-300 disabled:opacity-60"
                    />
                    Quick Action
                  </label>
                  {selectedSkill.is_quick_action && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Icon</label>
                      <select
                        value={selectedSkill.icon || 'Wand2'}
                        onChange={(e) => isEditing && handleUpdate({ icon: e.target.value })}
                        disabled={!isEditing}
                        className="px-2 py-1 border rounded-md bg-background text-sm disabled:opacity-60"
                      >
                        {AVAILABLE_ICONS.map((ic) => (
                          <option key={ic.name} value={ic.name}>{ic.label}</option>
                        ))}
                      </select>
                      <QuickActionIcon name={selectedSkill.icon || 'Wand2'} className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">System Prompt</label>
                    {isEditing && (
                      <VariableTipButton
                        onInsert={(v) => {
                          const el = document.getElementById('edit-system-prompt') as HTMLTextAreaElement | null
                          const prev = selectedSkill.system_prompt || ''
                          const start = el?.selectionStart ?? prev.length
                          const end = el?.selectionEnd ?? start
                          const next = prev.slice(0, start) + v + prev.slice(end)
                          handleUpdate({ system_prompt: next })
                          requestAnimationFrame(() => {
                            el?.setSelectionRange(start + v.length, start + v.length)
                            el?.focus()
                          })
                        }}
                      />
                    )}
                  </div>
                  <textarea
                    id="edit-system-prompt"
                    value={selectedSkill.system_prompt || ''}
                    onChange={(e) => isEditing && handleUpdate({ system_prompt: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border rounded-md bg-background min-h-[120px] font-mono text-sm mt-1 disabled:opacity-60"
                  />
                </div>

                {/* Prompt Template */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Prompt Template</label>
                  <div className="relative mt-1">
                    <textarea
                      id="edit-prompt-template"
                      value={selectedSkill.prompt_template || ''}
                      onChange={(e) => isEditing && handleUpdate({ prompt_template: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 pr-10 border rounded-md bg-background min-h-[120px] font-mono text-sm disabled:opacity-60"
                    />
                    {isEditing && (
                      <div className="absolute top-1.5 right-1.5">
                        <VariableTipButton
                          onInsert={(v) => {
                            const el = document.getElementById('edit-prompt-template') as HTMLTextAreaElement | null
                            const prev = selectedSkill.prompt_template || ''
                            const start = el?.selectionStart ?? prev.length
                            const end = el?.selectionEnd ?? start
                            const next = prev.slice(0, start) + v + prev.slice(end)
                            handleUpdate({ prompt_template: next })
                            requestAnimationFrame(() => {
                              el?.setSelectionRange(start + v.length, start + v.length)
                              el?.focus()
                            })
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Variables */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Variables (JSON)</label>
                  <textarea
                    value={selectedSkill.variables || '{}'}
                    onChange={(e) => isEditing && handleUpdate({ variables: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border rounded-md bg-background min-h-[60px] font-mono text-sm mt-1 disabled:opacity-60"
                  />
                </div>

                {/* Context Sources */}
                {selectedSkill.is_agentic && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Context Sources</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {CONTEXT_SOURCE_OPTIONS.map((source) => {
                        const active = parseContextSources(selectedSkill.context_sources).includes(source.id)
                        return (
                          <button
                            key={source.id}
                            onClick={() => isEditing && toggleContextSource(source.id)}
                            disabled={!isEditing}
                            className={`px-2 py-1 rounded text-xs border transition-colors disabled:opacity-60 ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-accent'
                            }`}
                          >
                            {active && <Check className="h-3 w-3 inline mr-1" />}
                            {source.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Specific Documents */}
                {selectedSkill.is_agentic && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Specific Documents (JSON array of titles)</label>
                    <textarea
                      value={selectedSkill.specific_documents || '[]'}
                      onChange={(e) => isEditing && handleUpdate({ specific_documents: e.target.value })}
                      disabled={!isEditing}
                      placeholder='["Chapter 1", "Prologue"]'
                      className="w-full px-3 py-2 border rounded-md bg-background min-h-[60px] font-mono text-sm mt-1 disabled:opacity-60"
                    />
                  </div>
                )}

                {/* Cross-agent refs */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cross-agent References</label>
                  <div className="text-xs text-muted-foreground mb-1">Agents that this agent can trigger or reference</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {skills?.filter((s) => s.id !== selectedSkill.id).map((s) => {
                      const active = parseCrossSkillRefs(selectedSkill.cross_skill_refs).includes(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            if (!isEditing) return
                            const current = parseCrossSkillRefs(selectedSkill.cross_skill_refs)
                            const next = active
                              ? current.filter((id) => id !== s.id)
                              : [...current, s.id]
                            handleUpdate({ cross_skill_refs: JSON.stringify(next) })
                          }}
                          disabled={!isEditing}
                          className={`px-2 py-1 rounded text-xs border transition-colors disabled:opacity-60 ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-accent'
                          }`}
                        >
                          {active && <Check className="h-3 w-3 inline mr-1" />}
                          {s.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Examples */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Example Input</label>
                    <textarea
                      value={selectedSkill.example_input || ''}
                      onChange={(e) => isEditing && handleUpdate({ example_input: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px] text-sm mt-1 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Example Output</label>
                    <textarea
                      value={selectedSkill.example_output || ''}
                      onChange={(e) => isEditing && handleUpdate({ example_output: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px] text-sm mt-1 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an agent to view or edit</p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: Test */}
        <ResizablePanel side="right" defaultWidth={320} storageKey="skills_right">
          <div className="flex flex-col h-full">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">Test Agent</h3>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {selectedSkill ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Test Input</label>
                    <textarea
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Enter test input..."
                      className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[100px] mt-1"
                    />
                  </div>
                  <button
                    onClick={handleTestSkill}
                    disabled={testLoading}
                    className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Render Prompt
                  </button>
                  {testResult && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Rendered Prompt</label>
                      <div className="p-2 bg-background rounded border text-xs font-mono whitespace-pre-wrap max-h-60 overflow-auto">
                        {testResult}
                      </div>
                    </div>
                  )}

                  {/* Cross-referenced agents */}
                  {parseCrossSkillRefs(selectedSkill.cross_skill_refs).length > 0 && (
                    <div className="pt-2 border-t">
                      <label className="text-xs font-medium text-muted-foreground">Referenced Agents</label>
                      <div className="space-y-1 mt-1">
                        {parseCrossSkillRefs(selectedSkill.cross_skill_refs).map((refId) => {
                          const refSkill = skills?.find((s) => s.id === refId)
                          if (!refSkill) return null
                          return (
                            <button
                              key={refId}
                              onClick={() => setSelectedSkill(refSkill)}
                              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-accent border truncate"
                            >
                              → {refSkill.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Select an agent to test</p>
              )}
            </div>
          </div>
        </ResizablePanel>
      </div>
    </div>
  )
}
