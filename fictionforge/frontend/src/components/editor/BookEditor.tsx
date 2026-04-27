import { useState, useRef } from 'react'
import type { TipTapEditorRef } from './TipTapEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import {
  BookOpen, Plus, Trash2, Loader2, GripVertical,
  Feather, ScrollText, BookMarked, Heart, MessageSquareQuote,
  Sparkles, Layers
} from 'lucide-react'
import TipTapEditor from './TipTapEditor'
import AIWritingSidebar from '../writing/AIWritingSidebar'
import { useDebounce } from '@/hooks/useDebounce'
import { useProjectTags } from '@/hooks/useProjectTags'

interface Document {
  id: string
  title: string
  content: string
  doc_type: string
  parent_id: string | null
  sort_order: number
  word_count: number
}

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
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDocType, setNewDocType] = useState('chapter')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const editorRef = useRef<TipTapEditorRef>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const queryClient = useQueryClient()

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

  const createDocMutation = useMutation({
    mutationFn: (data: { project_id: string; title: string; parent_id: string | null; doc_type: string }) =>
      api.post('/documents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      setShowNewForm(false)
      setNewTitle('')
      setNewDocType('chapter')
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
      parent_id: null,
      doc_type: newDocType,
    })
  }

  const handleDocContentChange = (content: string) => {
    if (selectedDoc) {
      setSelectedDoc({ ...selectedDoc, content })
    }
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

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    dragIndexRef.current = index
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    const dragIndex = dragIndexRef.current
    if (dragIndex === null || dragIndex === dropIndex) return

    const reordered = [...sections]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(dropIndex, 0, moved)

    reorderMutation.mutate(reordered.map((d) => d.id))
    dragIndexRef.current = null
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)]">
        {/* Section list */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            Sections
          </h2>
          <div className="space-y-1">
            {sections.length > 0 ? (
              sections.map((doc, index) => {
                const sectionInfo = getSectionInfo(doc.doc_type)
                const Icon = sectionInfo.icon
                return (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`flex items-center gap-1 p-2 rounded-md cursor-pointer hover:bg-accent ${
                      selectedDoc?.id === doc.id ? 'bg-accent' : ''
                    } ${dragOverIndex === index ? 'border-t-2 border-primary' : ''}`}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab shrink-0" />
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm truncate">{doc.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{doc.word_count}w</span>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sections yet
              </p>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className={`${sidebarCollapsed ? 'lg:col-span-10' : 'lg:col-span-7'} bg-card rounded-lg border flex flex-col overflow-hidden`}>
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
              <div className="flex-1 overflow-hidden">
                <TipTapEditor
                  ref={editorRef}
                  content={selectedDoc.content}
                  onChange={handleDocContentChange}
                  documents={(documents || []).map((d) => ({ id: d.id, title: d.title }))}
                  tags={projectTags || []}
                  onNavigateToDocument={(docId) => {
                    const doc = sections.find((d) => d.id === docId)
                    if (doc) {
                      setSelectedDoc(doc)
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
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a section to start writing</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Sidebar */}
        <div className={`${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} overflow-hidden rounded-lg border`}>
          <AIWritingSidebar
            getSelectedText={() => editorRef.current?.getSelectionInfo()?.text || ''}
            getFullContext={() => selectedDoc?.content || ''}
            onInsert={handleInsertText}
            projectId={projectId}
            currentDocumentId={selectedDoc?.id}
            onCollapseChange={setSidebarCollapsed}
          />
        </div>
      </div>
    </div>
  )
}
