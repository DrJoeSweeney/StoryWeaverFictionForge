import { useState, useEffect, useRef } from 'react'
import type { TipTapEditorRef } from '@/components/editor/TipTapEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Plus, BookMarked, Trash2, ArrowLeft } from 'lucide-react'
import TipTapEditor from '@/components/editor/TipTapEditor'
import AIWritingSidebar from '@/components/writing/AIWritingSidebar'
import { useDebounce } from '@/hooks/useDebounce'
import { useProjectTags } from '@/hooks/useProjectTags'

interface ProjectDocument {
  id: string
  title: string
  content: string
}

interface StoryBibleEntry {
  id: string
  category: string
  title: string
  content: string
  tags: string | null
}

const CATEGORIES = ['world', 'magic', 'history', 'culture', 'rules', 'locations', 'creatures']

export default function StoryBiblePage({ projectId }: { projectId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<StoryBibleEntry | null>(null)
  const [formData, setFormData] = useState({ category: 'world', title: '', content: '', tags: '' })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const editorRef = useRef<TipTapEditorRef>(null)
  const queryClient = useQueryClient()

  const { data: entries, isLoading } = useQuery({
    queryKey: ['story-bible', projectId],
    queryFn: async () => {
      const res = await api.get<StoryBibleEntry[]>(`/story-bible/project/${projectId}`)
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
    mutationFn: (data: typeof formData) => api.post(`/story-bible/project/${projectId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-bible', projectId] })
      setShowForm(false)
      setFormData({ category: 'world', title: '', content: '', tags: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StoryBibleEntry> }) =>
      api.put(`/story-bible/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-bible', projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => api.delete(`/story-bible/${entryId}`),
    onSuccess: (_data, entryId) => {
      queryClient.invalidateQueries({ queryKey: ['story-bible', projectId] })
      if (editingEntry?.id === entryId) setEditingEntry(null)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return
    createMutation.mutate(formData)
  }

  const handleInsertText = (text: string) => {
    if (!editingEntry || !editorRef.current) return
    const sel = editorRef.current.getSelectionInfo()
    if (sel && !sel.empty) {
      editorRef.current.replaceSelection(text)
    } else {
      editorRef.current.insertAtCursor(text)
    }
    editorRef.current.focus()
  }

  const debouncedContent = useDebounce(editingEntry?.content || '', 1000)
  useEffect(() => {
    if (editingEntry && debouncedContent && debouncedContent !== editingEntry.content) {
      updateMutation.mutate({ id: editingEntry.id, data: { content: debouncedContent } })
    }
  }, [debouncedContent])

  const grouped = entries?.reduce((acc, entry) => {
    acc[entry.category] = acc[entry.category] || []
    acc[entry.category].push(entry)
    return acc
  }, {} as Record<string, StoryBibleEntry[]>) || {}

  if (isLoading) return <div className="text-center py-12">Loading story bible...</div>

  // Editor workspace mode
  if (editingEntry) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setEditingEntry(null)}
            className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Story Bible
          </button>
          <button
            onClick={() => deleteMutation.mutate(editingEntry.id)}
            className="p-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)]">
          {/* Editor */}
          <div className={`${sidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-9'} bg-card rounded-lg border flex flex-col overflow-hidden`}>
            <div className="p-3 border-b space-y-3">
              <input
                value={editingEntry.title}
                onChange={(e) => {
                  const updated = { ...editingEntry, title: e.target.value }
                  setEditingEntry(updated)
                  updateMutation.mutate({ id: editingEntry.id, data: { title: e.target.value } })
                }}
                className="w-full text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0"
                placeholder="Entry title"
              />
              <div className="flex gap-2">
                <select
                  value={editingEntry.category}
                  onChange={(e) => {
                    const updated = { ...editingEntry, category: e.target.value }
                    setEditingEntry(updated)
                    updateMutation.mutate({ id: editingEntry.id, data: { category: e.target.value } })
                  }}
                  className="px-2 py-1 border rounded-md bg-background text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
                <input
                  value={editingEntry.tags || ''}
                  onChange={(e) => {
                    const updated = { ...editingEntry, tags: e.target.value }
                    setEditingEntry(updated)
                    updateMutation.mutate({ id: editingEntry.id, data: { tags: e.target.value } })
                  }}
                  placeholder="Tags (comma separated)"
                  className="flex-1 px-2 py-1 border rounded-md bg-background text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <TipTapEditor
                ref={editorRef}
                content={editingEntry.content}
                onChange={(content) => setEditingEntry({ ...editingEntry, content })}
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

          {/* AI Sidebar */}
          <div className={`${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} overflow-hidden rounded-lg border`}>
            <AIWritingSidebar
              getSelectedText={() => editorRef.current?.getSelectionInfo()?.text || ''}
              getFullContext={() => editingEntry?.content || ''}
              onInsert={handleInsertText}
              projectId={projectId}
              onCollapseChange={setSidebarCollapsed}
            />
          </div>
        </div>
      </div>
    )
  }

  // Grid view mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BookMarked className="h-5 w-5" />
          Story Bible
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Entry
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-card rounded-lg border space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Entry title"
              className="px-3 py-2 border rounded-md bg-background"
              required
            />
          </div>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Content..."
            className="w-full px-3 py-2 border rounded-md bg-background min-h-[120px]"
          />
          <input
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="Tags (comma separated)"
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Save Entry
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const catEntries = grouped[cat] || []
          if (catEntries.length === 0) return null
          return (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {catEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 bg-card rounded-lg border cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setEditingEntry(entry)}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold">{entry.title}</h4>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(entry.id) }}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">{entry.content}</p>
                    {entry.tags && (
                      <div className="flex gap-1 mt-2">
                        {entry.tags.split(',').map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-secondary rounded-full">
                            #{t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {entries?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookMarked className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No story bible entries yet</p>
          <p className="text-sm">Add worldbuilding, magic systems, history, and more</p>
        </div>
      )}
    </div>
  )
}
