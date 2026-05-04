import { useState, useRef, useMemo } from 'react'
import type { TipTapEditorRef } from '@/components/editor/TipTapEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import {
  Plus, Trash2, Loader2, Route, FileText, Target, BookOpen
} from 'lucide-react'
import TipTapEditor from '@/components/editor/TipTapEditor'
import AIWritingSidebar from '@/components/writing/AIWritingSidebar'
import FrontmatterEditor from '@/components/editor/FrontmatterEditor'
import { useDebounce } from '@/hooks/useDebounce'
import { useProjectTags } from '@/hooks/useProjectTags'
import DraggableTreePanel from '@/components/shared/DraggableTreePanel'
import ResizablePanel from '@/components/shared/ResizablePanel'

interface Document {
  id: string
  title: string
  content: string
  doc_type: string
  module: string
  classification: string
  parent_id: string | null
  sort_order: number
  word_count: number
  structure_type?: string
  [key: string]: any
}

const DOC_SYSTEM_FIELDS = [
  'id', 'created_at', 'updated_at', 'project_id', 'word_count',
  'content', 'doc_type', 'module', 'classification', 'parent_id',
  'sort_order', 'title', 'structure_type', 'children',
]

const STORY_PLAN_TYPES = ['outline', 'scene', 'beat']

const STRUCTURES = ['three-act', 'hero-journey', 'save-the-cat', 'freytag', 'custom']

function getStructureLabel(s: string) {
  return s.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getDocTypeInfo(docType: string) {
  if (docType === 'outline') return { label: 'Outline', icon: Route }
  if (docType === 'scene') return { label: 'Scene', icon: FileText }
  if (docType === 'beat') return { label: 'Beat', icon: Target }
  return { label: docType, icon: BookOpen }
}

export default function StoryEnginePage({ projectId }: { projectId: string }) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDocType, setNewDocType] = useState('outline')
  const [newParentId, setNewParentId] = useState<string | null>(null)
  const [newStructureType, setNewStructureType] = useState('three-act')
  const editorRef = useRef<TipTapEditorRef>(null)
  const queryClient = useQueryClient()

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: async () => {
      const res = await api.get<Document[]>(`/documents/project/${projectId}`)
      return res.data
    },
  })

  const { data: projectTags } = useProjectTags(projectId)

  // Filter to story-plan items only
  const storyPlanItems = (documents || [])
    .filter((d) => STORY_PLAN_TYPES.includes(d.doc_type))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  const createDocMutation = useMutation({
    mutationFn: (data: { project_id: string; title: string; parent_id: string | null; doc_type: string; structure_type?: string }) =>
      api.post('/documents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      setShowNewForm(false)
      setNewTitle('')
      setNewDocType('outline')
      setNewParentId(null)
      setNewStructureType('three-act')
    },
  })

  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Document> }) =>
      api.put(`/documents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
    },
  })

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      setSelectedDoc(null)
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (document_ids: string[]) =>
      api.post('/documents/reorder', { project_id: projectId, document_ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
    },
  })

  const nestMutation = useMutation({
    mutationFn: ({ id, parent_id }: { id: string; parent_id: string | null }) =>
      api.put(`/documents/${id}`, { parent_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
    },
  })

  const debouncedContent = useDebounce(selectedDoc?.content || '', 1000)

  // Auto-save when debounced content changes
  const prevDebouncedRef = useRef('')
  if (debouncedContent !== prevDebouncedRef.current && selectedDoc && debouncedContent) {
    prevDebouncedRef.current = debouncedContent
    updateDocMutation.mutate({ id: selectedDoc.id, data: { content: debouncedContent } })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !projectId) return
    const payload: any = {
      project_id: projectId,
      title: newTitle,
      parent_id: newParentId,
      doc_type: newDocType,
    }
    if (newDocType === 'outline') {
      payload.structure_type = newStructureType
    }
    createDocMutation.mutate(payload)
  }

  // Build flat list of all story-plan items for parent selector, with depth labels
  const buildParentOptions = (docs: Document[], depth = 0, parentId: string | null = null): { id: string; label: string }[] => {
    const children = docs.filter((d) => d.parent_id === parentId)
    let options: { id: string; label: string }[] = []
    if (depth === 0 && parentId === null) {
      options.push({ id: '', label: '— None (root level) —' })
    }
    for (const child of children) {
      options.push({ id: child.id, label: `${'  '.repeat(depth)}${child.title}` })
      options = options.concat(buildParentOptions(docs, depth + 1, child.id))
    }
    return options
  }

  const parentOptions = buildParentOptions(storyPlanItems)

  const handleDocContentChange = (content: string) => {
    if (selectedDoc) {
      setSelectedDoc({ ...selectedDoc, content })
    }
  }

  const getDocFrontmatter = (doc: Document): Record<string, any> => {
    return Object.fromEntries(Object.entries(doc).filter(([k, v]) => {
      if (DOC_SYSTEM_FIELDS.includes(k)) return false
      if (v === null || v === undefined) return true
      const t = typeof v
      if (t === 'string' || t === 'number' || t === 'boolean') return true
      if (Array.isArray(v)) return v.every((item) => typeof item !== 'object')
      return false
    }))
  }

  const existingFrontmatterKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const doc of documents || []) {
      for (const key of Object.keys(doc)) {
        if (!DOC_SYSTEM_FIELDS.includes(key)) {
          keys.add(key)
        }
      }
    }
    return Array.from(keys).sort()
  }, [documents])

  const handleFrontmatterChange = (newFrontmatter: Record<string, any>) => {
    if (!selectedDoc) return
    const oldFrontmatter = getDocFrontmatter(selectedDoc)
    const deletedKeys = Object.keys(oldFrontmatter).filter((k) => !(k in newFrontmatter))
    const payload: Record<string, any> = { ...newFrontmatter }
    if (deletedKeys.length > 0) payload._delete_keys = deletedKeys
    setSelectedDoc({ ...selectedDoc, ...newFrontmatter })
    updateDocMutation.mutate({ id: selectedDoc.id, data: payload })
  }

  const handleInsertText = (text: string) => {
    if (!selectedDoc || !editorRef.current) return
    const sel = editorRef.current.getSelectionInfo()
    if (sel && !sel.empty) {
      editorRef.current.replaceSelection(text)
    } else {
      editorRef.current.insertAtCursor(text)
    }
    editorRef.current.focus()
  }

  const handleAppendText = (text: string) => {
    if (!selectedDoc || !editorRef.current) return
    editorRef.current.appendToEnd(text)
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
          New Item
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleCreate} className="p-4 bg-card rounded-lg border space-y-3">
          <div className="flex gap-2">
            <select
              value={newDocType}
              onChange={(e) => setNewDocType(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="outline">Outline</option>
              <option value="scene">Scene</option>
              <option value="beat">Beat</option>
            </select>
            {newDocType === 'outline' && (
              <select
                value={newStructureType}
                onChange={(e) => setNewStructureType(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                {STRUCTURES.map((s) => (
                  <option key={s} value={s}>{getStructureLabel(s)}</option>
                ))}
              </select>
            )}
            <select
              value={newParentId || ''}
              onChange={(e) => setNewParentId(e.target.value || null)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
              title="Parent item"
            >
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              className="flex-1 px-3 py-2 border rounded-md bg-background"
              required
            />
            <button
              type="submit"
              disabled={createDocMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-280px)]">
        {/* Tree panel */}
        <ResizablePanel side="left" defaultWidth={220} storageKey="story_engine_left">
          <div className="p-4 h-full overflow-auto">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Story Plan
            </h2>
            <DraggableTreePanel
              items={storyPlanItems.map((d) => ({ ...d, title: d.title, parent_id: d.parent_id || null, sort_order: d.sort_order || 0 }))}
              selectedId={selectedDoc?.id}
              onSelect={(item) => setSelectedDoc(item as Document)}
              onReorder={(ids) => reorderMutation.mutate(ids)}
              onNest={(id, parentId) => nestMutation.mutate({ id, parent_id: parentId })}
              renderIcon={(item) => {
                const Icon = getDocTypeInfo(item.doc_type).icon
                return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              }}
              renderBadge={(item) => (
                <span className="text-xs text-muted-foreground shrink-0">{item.word_count}w</span>
              )}
              emptyMessage="No items yet"
            />
          </div>
        </ResizablePanel>

        {/* Editor */}
        <div className="flex-1 min-w-0 bg-card rounded-lg border flex flex-col overflow-hidden">
          {selectedDoc ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs px-2 py-0.5 bg-secondary rounded-full uppercase tracking-wider">
                    {getDocTypeInfo(selectedDoc.doc_type).label}
                  </span>
                  <input
                    value={selectedDoc.title}
                    onChange={(e) => {
                      const updated = { ...selectedDoc, title: e.target.value }
                      setSelectedDoc(updated)
                      updateDocMutation.mutate({ id: selectedDoc.id, data: { title: e.target.value } })
                    }}
                    className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 flex-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {selectedDoc.word_count} words
                  </span>
                  {updateDocMutation.isPending && (
                    <span className="text-xs text-muted-foreground">Saving...</span>
                  )}
                  <button
                    onClick={() => deleteDocMutation.mutate(selectedDoc.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <FrontmatterEditor
                key={selectedDoc.id}
                frontmatter={getDocFrontmatter(selectedDoc)}
                systemFields={DOC_SYSTEM_FIELDS}
                existingKeys={existingFrontmatterKeys}
                documents={(documents || []).map((d) => ({ id: d.id, title: d.title }))}
                onChange={handleFrontmatterChange}
                onNavigateToDocument={(docId, heading) => {
                  const doc = storyPlanItems.find((d) => d.id === docId)
                  if (doc) {
                    setSelectedDoc(doc)
                    if (heading) {
                      requestAnimationFrame(() => {
                        const pm = document.querySelector('.ProseMirror')
                        if (!pm) return
                        const headings = pm.querySelectorAll('h1, h2, h3, h4, h5, h6')
                        for (const h of headings) {
                          if (h.textContent?.trim().toLowerCase() === heading.trim().toLowerCase()) {
                            h.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            break
                          }
                        }
                      })
                    }
                  }
                }}
              />
              <div className="flex-1 overflow-hidden">
                <TipTapEditor
                  key={selectedDoc.id}
                  ref={editorRef}
                  content={selectedDoc.content}
                  onChange={handleDocContentChange}
                  documents={(documents || []).map((d) => ({ id: d.id, title: d.title, content: d.content }))}
                  tags={projectTags || []}
                  onNavigateToDocument={(docId, heading) => {
                    const doc = storyPlanItems.find((d) => d.id === docId)
                    if (doc) {
                      setSelectedDoc(doc)
                      if (heading) {
                        requestAnimationFrame(() => {
                          const pm = document.querySelector('.ProseMirror')
                          if (!pm) return
                          const headings = pm.querySelectorAll('h1, h2, h3, h4, h5, h6')
                          for (const h of headings) {
                            if (h.textContent?.trim().toLowerCase() === heading.trim().toLowerCase()) {
                              h.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              break
                            }
                          }
                        })
                      }
                    }
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
                <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an item to start planning</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Sidebar */}
        <ResizablePanel side="right" defaultWidth={320} storageKey="story_engine_right">
          <AIWritingSidebar
            getSelectedText={() => editorRef.current?.getSelectionInfo()?.text || ''}
            getFullContext={() => selectedDoc?.content || ''}
            onInsert={handleInsertText}
            onAppend={handleAppendText}
            projectId={projectId}
            currentDocumentId={selectedDoc?.id}
            currentDocumentTitle={selectedDoc?.title}
            currentDocumentType={selectedDoc?.doc_type}
            currentFieldName="content"
            moduleName="StoryPlan"
          />
        </ResizablePanel>
      </div>
    </div>
  )
}
