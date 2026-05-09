import { useState, useRef, useMemo, useCallback } from 'react'
import type { TipTapEditorRef } from './TipTapEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import {
  BookOpen, Plus, Trash2, Loader2,
  Feather, ScrollText, BookMarked, Heart, MessageSquareQuote,
  Sparkles, Layers
} from 'lucide-react'
import DraggableTreePanel from '@/components/shared/DraggableTreePanel'
import ResizablePanel from '@/components/shared/ResizablePanel'
import TipTapEditor from './TipTapEditor'
import AIWritingSidebar from '../writing/AIWritingSidebar'
import FrontmatterEditor from './FrontmatterEditor'
import BacklinksPanel from './BacklinksPanel'
import OutgoingLinksPanel from './OutgoingLinksPanel'
import TagPageModal from '@/components/tags/TagPageModal'

import { useDebounce } from '@/hooks/useDebounce'
import { useProjectTags } from '@/hooks/useProjectTags'
import { usePersistedSelectionId } from '@/hooks/usePersistedSelection'

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
  [key: string]: any
}

const DOC_SYSTEM_FIELDS = ['id', 'created_at', 'updated_at', 'project_id', 'word_count', 'content', 'doc_type', 'module', 'classification', 'parent_id', 'sort_order', 'title']

const SECTION_TYPES = [
  { id: 'chapter', label: 'Chapter', icon: BookOpen },
  { id: 'prologue', label: 'Prologue', icon: Feather },
  { id: 'epilogue', label: 'Epilogue', icon: ScrollText },
  { id: 'dedication', label: 'Dedication', icon: Heart },
  { id: 'foreword', label: 'Foreword', icon: MessageSquareQuote },
  { id: 'afterword', label: 'Afterword', icon: Sparkles },
  { id: 'acknowledgments', label: 'Acknowledgments', icon: Layers },
  { id: 'part', label: 'Part', icon: BookMarked },
]

const BOOK_SECTION_TYPES = SECTION_TYPES.map((s) => s.id)

function getSectionInfo(docType: string) {
  return SECTION_TYPES.find((s) => s.id === docType) || SECTION_TYPES[0]
}

export default function BookEditor({ projectId }: { projectId: string }) {
  const [persistedId, setPersistedId] = usePersistedSelectionId(`ff-project-${projectId}-writing-selection`)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDocType, setNewDocType] = useState('chapter')
  const [newParentId, setNewParentId] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const editorRef = useRef<TipTapEditorRef>(null)
  const queryClient = useQueryClient()
  const persistedTitleRef = useRef<string>('')

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: async () => {
      const res = await api.get<Document[]>(`/documents/project/${projectId}`)
      return res.data
    },
  })

  const { data: projectTags } = useProjectTags(projectId)

  // Filter to book sections only, sorted by sort_order
  const sections = (documents || [])
    .filter((d) => BOOK_SECTION_TYPES.includes(d.doc_type) || !d.doc_type)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  const selectedDoc = useMemo(() => sections.find((d) => d.id === persistedId) || null, [sections, persistedId])
  const setSelectedDoc = useCallback((doc: Document | null) => setPersistedId(doc?.id || null), [setPersistedId])

  const createDocMutation = useMutation({
    mutationFn: (data: { project_id: string; title: string; parent_id: string | null; doc_type: string }) =>
      api.post('/documents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      setShowNewForm(false)
      setNewTitle('')
      setNewDocType('chapter')
      setNewParentId(null)
    },
  })

  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Document> }) =>
      api.put(`/documents/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['documents', projectId] })
      const previousDocs = queryClient.getQueryData<Document[]>(['documents', projectId])
      queryClient.setQueryData(['documents', projectId], (old: Document[] | undefined) => {
        if (!old) return old
        return old.map((doc) => (doc.id === id ? { ...doc, ...data } : doc))
      })
      return { previousDocs }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousDocs) {
        queryClient.setQueryData(['documents', projectId], context.previousDocs)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-tags', projectId] })
    },
  })

  const renameDocMutation = useMutation({
    mutationFn: ({ id, new_title }: { id: string; new_title: string }) =>
      api.post(`/documents/${id}/rename`, { new_title }),
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
    createDocMutation.mutate({
      project_id: projectId,
      title: newTitle,
      parent_id: newParentId,
      doc_type: newDocType,
    })
  }

  // Build flat list of all documents for parent selector, with depth labels
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

  const parentOptions = buildParentOptions(documents || [])

  const handleDocContentChange = (content: string) => {
    if (!selectedDoc) return
    queryClient.setQueryData(['documents', projectId], (old: Document[] | undefined) => {
      if (!old) return old
      return old.map((doc) => (doc.id === selectedDoc.id ? { ...doc, content } : doc))
    })
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
    // TipTap onUpdate will fire and update parent state via onChange;
    // debounced auto-save handles persistence.
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
          New Section
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
              {SECTION_TYPES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select
              value={newParentId || ''}
              onChange={(e) => setNewParentId(e.target.value || null)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
              title="Parent section"
            >
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Section title"
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
        {/* Section list */}
        <ResizablePanel side="left" defaultWidth={220} storageKey="book_editor_left">
          <div className="p-4 h-full overflow-auto">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Sections
            </h2>
            <DraggableTreePanel
              items={sections.map((d) => ({ ...d, title: d.title, parent_id: d.parent_id || null, sort_order: d.sort_order || 0 }))}
              selectedId={selectedDoc?.id}
              onSelect={(item) => {
                const doc = item as Document
                setSelectedDoc(doc)
                persistedTitleRef.current = doc.title
              }}
              onReorder={(ids) => reorderMutation.mutate(ids)}
              onNest={(id, parentId) => nestMutation.mutate({ id, parent_id: parentId })}
              renderIcon={(item) => {
                const Icon = getSectionInfo(item.doc_type).icon
                return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              }}
              renderBadge={(item) => (
                <span className="text-xs text-muted-foreground shrink-0">{item.word_count}w</span>
              )}
              emptyMessage="No sections yet"
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
                    {getSectionInfo(selectedDoc.doc_type).label}
                  </span>
                  <input
                    value={selectedDoc.title}
                    onChange={(e) => {
                      setSelectedDoc({ ...selectedDoc, title: e.target.value })
                    }}
                    onBlur={(e) => {
                      const newTitle = e.target.value
                      if (newTitle !== persistedTitleRef.current) {
                        renameDocMutation.mutate({ id: selectedDoc.id, new_title: newTitle })
                        persistedTitleRef.current = newTitle
                      }
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
                documents={(documents || []).map((d) => ({ id: d.id, title: d.title, aliases: d.aliases }))}
                onChange={handleFrontmatterChange}
                onNavigateToDocument={(docId, heading) => {
                  const doc = sections.find((d) => d.id === docId)
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
                content={selectedDoc.content}
              />
              <div className="flex-1 overflow-hidden">
                <TipTapEditor
                  key={selectedDoc.id}
                  ref={editorRef}
                  content={selectedDoc.content}
                  onChange={handleDocContentChange}
                  documents={(documents || []).map((d) => ({ id: d.id, title: d.title, content: d.content, aliases: d.aliases, summary: d.summary }))}
                  tags={projectTags || []}
                  onNavigateToDocument={(docId, heading) => {
                    const doc = sections.find((d) => d.id === docId)
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
                    setActiveTag(tag)
                  }}
                />
              </div>
              <BacklinksPanel
                sources={(documents || []).map((d) => ({ id: d.id, title: d.title, content: d.content, aliases: d.aliases }))}
                currentTitle={selectedDoc.title}
                onNavigateToDocument={(docId) => {
                  const doc = sections.find((d) => d.id === docId)
                  if (doc) setSelectedDoc(doc)
                }}
              />
              <OutgoingLinksPanel
                documents={(documents || []).map((d) => ({ id: d.id, title: d.title }))}
                content={selectedDoc.content}
                onNavigateToDocument={(docId, heading) => {
                  const doc = sections.find((d) => d.id === docId)
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
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a section to start writing</p>
              </div>
            </div>
          )}
        </div>

        {activeTag && (
          <TagPageModal
            projectId={projectId}
            tag={activeTag}
            onClose={() => setActiveTag(null)}
          />
        )}

        {/* AI Sidebar */}
        <ResizablePanel side="right" defaultWidth={320} storageKey="book_editor_right">
          <AIWritingSidebar
            getSelectedText={() => editorRef.current?.getSelectionInfo()?.text || ''}
            getFullContext={() => selectedDoc?.content || ''}
            onInsert={handleInsertText}
            onAppend={handleAppendText}
            projectId={projectId}
            currentDocumentId={selectedDoc?.id}
            currentDocumentTitle={selectedDoc?.title}
            currentDocumentType={selectedDoc?.doc_type}
            currentDocumentSummary={selectedDoc?.summary}
            currentFieldName="content"
            moduleName="Writing"
          />
        </ResizablePanel>
      </div>
    </div>
  )
}
