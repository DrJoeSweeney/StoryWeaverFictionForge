import { useState, useRef, useMemo } from 'react'
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
import DraggableTreePanel from '@/components/shared/DraggableTreePanel'
import ResizablePanel from '@/components/shared/ResizablePanel'
import FrontmatterEditor from '@/components/editor/FrontmatterEditor'

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
  module: string
  classification: string
  [key: string]: any
}

const WORLD_SYSTEM_FIELDS = ['id', 'created_at', 'updated_at', 'project_id', 'word_count', 'content', 'category', 'title', 'tags', 'module', 'classification', 'parent_id', 'sort_order']

const CATEGORIES = ['world', 'magic', 'history', 'culture', 'rules', 'locations', 'creatures', 'technology', 'politics', 'economics']

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

  const treeItems = (entries || []).map((e) => ({
    ...e,
    parent_id: (e as any).parent_id || null,
    sort_order: (e as any).sort_order || 0,
  }))

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

  const reorderMutation = useMutation({
    mutationFn: (itemIds: string[]) =>
      api.post(`/story-bible/reorder`, { project_id: projectId, item_ids: itemIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['world', projectId] })
    },
  })

  const nestMutation = useMutation({
    mutationFn: ({ id, parent_id }: { id: string; parent_id: string | null }) =>
      api.put(`/story-bible/${id}`, { parent_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['world', projectId] })
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

  const getFrontmatter = (entry: WorldEntry): Record<string, any> => {
    return Object.fromEntries(Object.entries(entry).filter(([k, v]) => {
      if (WORLD_SYSTEM_FIELDS.includes(k)) return false
      if (v === null || v === undefined) return true
      const t = typeof v
      if (t === 'string' || t === 'number' || t === 'boolean') return true
      if (Array.isArray(v)) return v.every((item) => typeof item !== 'object')
      return false
    }))
  }

  const existingFrontmatterKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const entry of entries || []) {
      for (const key of Object.keys(entry)) {
        if (!WORLD_SYSTEM_FIELDS.includes(key)) {
          keys.add(key)
        }
      }
    }
    return Array.from(keys).sort()
  }, [entries])

  const handleFrontmatterChange = (newFrontmatter: Record<string, any>) => {
    if (!selectedEntry) return
    const oldFrontmatter = getFrontmatter(selectedEntry)
    const deletedKeys = Object.keys(oldFrontmatter).filter((k) => !(k in newFrontmatter))
    const payload: Record<string, any> = { ...newFrontmatter }
    if (deletedKeys.length > 0) payload._delete_keys = deletedKeys
    setSelectedEntry({ ...selectedEntry, ...newFrontmatter })
    updateMutation.mutate({ id: selectedEntry.id, data: payload })
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

      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-280px)]">
        {/* Entry list */}
        <ResizablePanel side="left" defaultWidth={220} storageKey="world_left">
          <div className="p-4 h-full overflow-auto">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Story Bible
            </h2>
            <DraggableTreePanel
              items={treeItems}
              selectedId={selectedEntry?.id}
              onSelect={(item) => setSelectedEntry(item as unknown as WorldEntry)}
              onReorder={(itemIds) => reorderMutation.mutate(itemIds)}
              onNest={(itemId, parentId) => nestMutation.mutate({ id: itemId, parent_id: parentId })}
              renderIcon={() => <Globe className="h-4 w-4 text-muted-foreground shrink-0" />}
              renderBadge={(item) => (
                <span className="text-[10px] text-muted-foreground shrink-0 uppercase">
                  {item.category}
                </span>
              )}
              emptyMessage="No entries yet"
            />
          </div>
        </ResizablePanel>

        {/* Editor */}
        <div className="flex-1 min-w-0 bg-card rounded-lg border flex flex-col overflow-hidden">
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
              <FrontmatterEditor
                key={selectedEntry.id}
                frontmatter={getFrontmatter(selectedEntry)}
                systemFields={WORLD_SYSTEM_FIELDS}
                existingKeys={existingFrontmatterKeys}
                documents={(projectDocs || []).map((d) => ({ id: d.id, title: d.title }))}
                onChange={handleFrontmatterChange}
                onNavigateToDocument={(docId) => {
                  const doc = projectDocs?.find((d) => d.id === docId)
                  if (doc) {
                    console.log('Navigate to document:', docId)
                  }
                }}
              />
              <div className="flex-1 overflow-hidden">
                <TipTapEditor
                  ref={editorRef}
                  content={selectedEntry.content}
                  onChange={handleContentChange}
                  documents={(projectDocs || []).map((d) => ({ id: d.id, title: d.title, content: d.content }))}
                  tags={projectTags || []}
                  onNavigateToDocument={(docId, heading) => {
                    const doc = projectDocs?.find((d) => d.id === docId)
                    if (doc) {
                      console.log('Navigate to document:', docId, heading)
                    }
                  }}
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
        <ResizablePanel side="right" defaultWidth={320} storageKey="world_right">
          <AIWritingSidebar
            getSelectedText={() => editorRef.current?.getSelectionInfo()?.text || ''}
            getFullContext={() => selectedEntry?.content || ''}
            onInsert={handleInsertText}
            projectId={projectId}
            currentDocumentId={selectedEntry?.id}
            currentDocumentTitle={selectedEntry?.title}
            currentDocumentType="story_bible"
            currentDocumentCategory={selectedEntry?.category}
            currentFieldName="content"
            moduleName="Story Bible"
          />
        </ResizablePanel>
      </div>
    </div>
  )
}
