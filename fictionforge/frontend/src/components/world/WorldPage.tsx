import { useState, useRef } from 'react'
import type { TipTapEditorRef } from '@/components/editor/TipTapEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import {
  Plus, Trash2, Loader2, BookMarked, Globe
} from 'lucide-react'
import TipTapEditor from '@/components/editor/TipTapEditor'
import AIWritingSidebar from '@/components/writing/AIWritingSidebar'
import { useDebounce } from '@/hooks/useDebounce'
import { useProjectTags } from '@/hooks/useProjectTags'

interface ProjectDocument {
  id: string
  title: string
  content: string
}

interface WorldEntry {
  id: string
  category: string
  title: string
  content: string
  tags: string | null
}

const CATEGORIES = ['world', 'magic', 'history', 'culture', 'rules', 'locations', 'creatures']

function getCategoryLabel(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function WorldPage({ projectId }: { projectId: string }) {
  const [selectedEntry, setSelectedEntry] = useState<WorldEntry | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('world')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const editorRef = useRef<TipTapEditorRef>(null)
  const queryClient = useQueryClient()

  const { data: entries, isLoading } = useQuery({
    queryKey: ['world', projectId],
    queryFn: async () => {
      const res = await api.get<WorldEntry[]>(`/story-bible/project/${projectId}`)
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

  // Sort entries by category then title
  const sortedEntries = (entries || [])
    .sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category)
      return catCompare !== 0 ? catCompare : a.title.localeCompare(b.title)
    })

  const createMutation = useMutation({
    mutationFn: (data: { project_id: string; category: string; title: string; content: string; tags: string }) =>
      api.post(`/story-bible/project/${projectId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['world', projectId] })
      setShowNewForm(false)
      setNewTitle('')
      setNewCategory('world')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorldEntry> }) =>
      api.put(`/story-bible/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['world', projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/story-bible/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['world', projectId] })
      setSelectedEntry(null)
    },
  })

  const debouncedContent = useDebounce(selectedEntry?.content || '', 1000)

  // Auto-save when debounced content changes
  const prevDebouncedRef = useRef('')
  if (debouncedContent !== prevDebouncedRef.current && selectedEntry && debouncedContent) {
    prevDebouncedRef.current = debouncedContent
    updateMutation.mutate({ id: selectedEntry.id, data: { content: debouncedContent } })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    createMutation.mutate({
      project_id: projectId,
      category: newCategory,
      title: newTitle,
      content: '',
      tags: '',
    })
  }

  const handleContentChange = (content: string) => {
    if (selectedEntry) {
      setSelectedEntry({ ...selectedEntry, content })
    }
  }

  const handleInsertText = (text: string) => {
    if (!selectedEntry || !editorRef.current) return
    const sel = editorRef.current.getSelectionInfo()
    if (sel && !sel.empty) {
      editorRef.current.replaceSelection(text)
    } else {
      editorRef.current.insertAtCursor(text)
    }
    editorRef.current.focus()
  }

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
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" />
          New Entry
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleCreate} className="p-4 bg-card rounded-lg border space-y-3">
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{getCategoryLabel(c)}</option>
              ))}
            </select>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Entry title"
              className="flex-1 px-3 py-2 border rounded-md bg-background"
              required
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)]">
        {/* Entry list */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            World
          </h2>
          <div className="space-y-1">
            {sortedEntries.length > 0 ? (
              sortedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-1 p-2 rounded-md cursor-pointer hover:bg-accent ${
                    selectedEntry?.id === entry.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedEntry(entry)}
                >
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm truncate">{entry.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 uppercase">
                    {entry.category}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No entries yet
              </p>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className={`${sidebarCollapsed ? 'lg:col-span-10' : 'lg:col-span-7'} bg-card rounded-lg border flex flex-col overflow-hidden`}>
          {selectedEntry ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs px-2 py-0.5 bg-secondary rounded-full uppercase tracking-wider">
                    {getCategoryLabel(selectedEntry.category)}
                  </span>
                  <input
                    value={selectedEntry.title}
                    onChange={(e) => {
                      const updated = { ...selectedEntry, title: e.target.value }
                      setSelectedEntry(updated)
                      updateMutation.mutate({ id: selectedEntry.id, data: { title: e.target.value } })
                    }}
                    className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 flex-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {countWords(selectedEntry.content)} words
                  </span>
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
              <div className="px-3 py-2 border-b bg-secondary/20">
                <div className="flex gap-2">
                  <select
                    value={selectedEntry.category}
                    onChange={(e) => {
                      const updated = { ...selectedEntry, category: e.target.value }
                      setSelectedEntry(updated)
                      updateMutation.mutate({ id: selectedEntry.id, data: { category: e.target.value } })
                    }}
                    className="px-2 py-1 border rounded-md bg-background text-xs"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{getCategoryLabel(c)}</option>
                    ))}
                  </select>
                  <input
                    value={selectedEntry.tags || ''}
                    onChange={(e) => {
                      const updated = { ...selectedEntry, tags: e.target.value }
                      setSelectedEntry(updated)
                      updateMutation.mutate({ id: selectedEntry.id, data: { tags: e.target.value } })
                    }}
                    placeholder="Tags (comma separated)"
                    className="flex-1 px-2 py-1 border rounded-md bg-background text-xs"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <TipTapEditor
                  ref={editorRef}
                  content={selectedEntry.content}
                  onChange={handleContentChange}
                  documents={(projectDocs || []).map((d) => ({ id: d.id, title: d.title }))}
                  tags={projectTags || []}
                  onNavigateToDocument={() => {}}
                  onTagClick={(tag) => console.log('Tag clicked:', tag)}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <BookMarked className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an entry to start writing</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Sidebar */}
        <div className={`${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} overflow-hidden rounded-lg border`}>
          <AIWritingSidebar
            getSelectedText={() => editorRef.current?.getSelectionInfo()?.text || ''}
            getFullContext={() => selectedEntry?.content || ''}
            onInsert={handleInsertText}
            projectId={projectId}
            currentDocumentId={selectedEntry?.id}
            onCollapseChange={setSidebarCollapsed}
          />
        </div>
      </div>
    </div>
  )
}
