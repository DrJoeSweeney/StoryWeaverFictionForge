import { useState, useRef } from 'react'
import type { TipTapEditorRef } from '@/components/editor/TipTapEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Plus, Trash2, Loader2, Palette } from 'lucide-react'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { useProjectTags } from '@/hooks/useProjectTags'

interface ProjectDocument {
  id: string
  title: string
  content: string
}

interface StyleGuideEntry {
  id: string
  title: string
  content: string
  word_count: number
}

export default function StyleGuidePage({ projectId }: { projectId: string }) {
  const [selectedEntry, setSelectedEntry] = useState<StyleGuideEntry | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const editorRef = useRef<TipTapEditorRef>(null)
  const queryClient = useQueryClient()

  const { data: entries, isLoading } = useQuery({
    queryKey: ['style-guide', projectId],
    queryFn: async () => {
      const res = await api.get<StyleGuideEntry[]>(`/style-guide/project/${projectId}`)
      return res.data
    },
  })

  const { data: projectDocs } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: async () => {
      const res = await api.get<ProjectDocument[]>(`/documents/project/${projectId}`)
      return res.data
    },
  })

  const { data: projectTags } = useProjectTags(projectId)

  const createMutation = useMutation({
    mutationFn: (data: { project_id: string; title: string; content: string }) =>
      api.post('/style-guide', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['style-guide', projectId] })
      setShowNewForm(false)
      setNewTitle('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StyleGuideEntry> }) =>
      api.put(`/style-guide/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['style-guide', projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/style-guide/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['style-guide', projectId] })
      setSelectedEntry(null)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    createMutation.mutate({ project_id: projectId, title: newTitle, content: '' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)]">
      {/* Entry list */}
      <div className="lg:col-span-3 bg-card rounded-lg border p-4 overflow-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Style Guide
          </h2>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="p-1.5 bg-primary text-primary-foreground rounded-md"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {showNewForm && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Entry title"
              className="flex-1 px-2 py-1 border rounded-md bg-background text-sm"
              required
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs disabled:opacity-50"
            >
              Add
            </button>
          </form>
        )}

        <div className="space-y-1">
          {entries && entries.length > 0 ? (
            entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                  selectedEntry?.id === entry.id ? 'bg-accent' : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{entry.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{entry.word_count}w</span>
                </div>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No entries yet
            </p>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="lg:col-span-9 bg-card rounded-lg border flex flex-col overflow-hidden">
        {selectedEntry ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b">
              <input
                value={selectedEntry.title}
                onChange={(e) => {
                  const updated = { ...selectedEntry, title: e.target.value }
                  setSelectedEntry(updated)
                  updateMutation.mutate({ id: selectedEntry.id, data: { title: e.target.value } })
                }}
                className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 flex-1"
              />
              <div className="flex items-center gap-3">
                {updateMutation.isPending && (
                  <span className="text-xs text-muted-foreground">Saving...</span>
                )}
                <button
                  onClick={() => deleteMutation.mutate(selectedEntry.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <TipTapEditor
                ref={editorRef}
                content={selectedEntry.content}
                onChange={(content) => {
                  setSelectedEntry({ ...selectedEntry, content })
                  updateMutation.mutate({ id: selectedEntry.id, data: { content } })
                }}
                documents={(projectDocs || []).map((d) => ({ id: d.id, title: d.title }))}
                tags={projectTags || []}
                onNavigateToDocument={(docId) => {
                  console.log('Navigate to document:', docId)
                }}
                onTagClick={(tag) => {
                  console.log('Tag clicked:', tag)
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select an entry to edit your style guide</p>
              <p className="text-sm mt-2">Add writing examples, voice notes, and style rules</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
