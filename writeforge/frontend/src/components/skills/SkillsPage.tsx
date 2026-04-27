import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Plus, Wand2, Trash2, Save, Sparkles, Copy } from 'lucide-react'

interface Skill {
  id: string
  name: string
  description: string | null
  category: string
  prompt_template: string
  variables: string | null
  example_input: string | null
  example_output: string | null
}

const CATEGORIES = ['writing', 'style', 'worldbuilding', 'character', 'dialogue', 'plot']

export default function SkillsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [formData, setFormData] = useState({
    name: '', description: '', category: 'writing', prompt_template: '',
    variables: '{}', example_input: '', example_output: ''
  })
  const queryClient = useQueryClient()

  const { data: skills, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await api.get<Skill[]>('/skills')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/skills', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      setShowForm(false)
      setFormData({ name: '', description: '', category: 'writing', prompt_template: '', variables: '{}', example_input: '', example_output: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Skill> }) =>
      api.put(`/skills/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      setEditingSkill(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.prompt_template.trim()) return
    createMutation.mutate(formData)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (isLoading) return <div className="text-center py-12">Loading skills...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="h-6 w-6" />
            Skill Bank
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create reusable prompt templates for your writing workflow
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" />
          New Skill
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-card rounded-lg border space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Skill name"
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
          </div>
          <input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description"
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
          <textarea
            value={formData.prompt_template}
            onChange={(e) => setFormData({ ...formData, prompt_template: e.target.value })}
            placeholder="Prompt template (use {{variable}} syntax)..."
            className="w-full px-3 py-2 border rounded-md bg-background min-h-[120px] font-mono text-sm"
            required
          />
          <input
            value={formData.variables}
            onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
            placeholder='Variables JSON (e.g., {"genre": "", "tone": ""})'
            className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea
              value={formData.example_input}
              onChange={(e) => setFormData({ ...formData, example_input: e.target.value })}
              placeholder="Example input"
              className="px-3 py-2 border rounded-md bg-background min-h-[80px] text-sm"
            />
            <textarea
              value={formData.example_output}
              onChange={(e) => setFormData({ ...formData, example_output: e.target.value })}
              placeholder="Example output"
              className="px-3 py-2 border rounded-md bg-background min-h-[80px] text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Create Skill
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills?.map((skill) => (
          <div key={skill.id} className="p-4 bg-card rounded-lg border">
            {editingSkill?.id === skill.id ? (
              <div className="space-y-2">
                <input
                  value={editingSkill.name}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  className="w-full px-2 py-1 border rounded bg-background font-semibold"
                />
                <textarea
                  value={editingSkill.prompt_template}
                  onChange={(e) => setEditingSkill({ ...editingSkill, prompt_template: e.target.value })}
                  className="w-full px-2 py-1 border rounded bg-background min-h-[80px] font-mono text-xs"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateMutation.mutate({ id: skill.id, data: editingSkill })}
                    className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                  >
                    <Save className="h-3 w-3" /> Save
                  </button>
                  <button onClick={() => setEditingSkill(null)} className="px-2 py-1 border rounded text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{skill.name}</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-secondary rounded-full mt-1 inline-block capitalize">
                      {skill.category}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => copyToClipboard(skill.prompt_template)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Copy template"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setEditingSkill(skill)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Save className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(skill.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {skill.description && (
                  <p className="text-sm text-muted-foreground mt-2">{skill.description}</p>
                )}
                <div className="mt-3 p-2 bg-background rounded border">
                  <code className="text-xs text-muted-foreground whitespace-pre-wrap">{skill.prompt_template}</code>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {skills?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No skills yet</p>
          <p className="text-sm">Create your first writing skill to get started</p>
        </div>
      )}
    </div>
  )
}
