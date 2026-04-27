import { useState, useRef } from 'react'
import type { TipTapEditorRef } from './TipTapEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import {
  ChevronRight, ChevronDown, FileText, Folder, Plus, Trash2, Loader2
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
  children?: Document[]
}

export default function DocumentEditor({ projectId }: { projectId: string }) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [showNewDocForm, setShowNewDocForm] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  // Filter to notes only
  const notes = (documents || []).filter((d) => d.doc_type === 'note')

  const createDocMutation = useMutation({
    mutationFn: (data: { project_id: string; title: string; parent_id: string | null; doc_type: string }) =>
      api.post('/documents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      setShowNewDocForm(false)
      setNewDocTitle('')
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

  const toggleExpand = (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }

  const handleCreateDoc = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDocTitle.trim() || !projectId) return
    createDocMutation.mutate({
      project_id: projectId,
      title: newDocTitle,
      parent_id: null,
      doc_type: 'note',
    })
  }

  const handleDocContentChange = (content: string) => {
    if (selectedDoc) {
      setSelectedDoc({ ...selectedDoc, content })
    }
  }

  const debouncedContent = useDebounce(selectedDoc?.content || '', 1000)
  const prevDebouncedRef = useRef('')
  if (debouncedContent !== prevDebouncedRef.current && selectedDoc && debouncedContent) {
    prevDebouncedRef.current = debouncedContent
    updateDocMutation.mutate({ id: selectedDoc.id, data: { content: debouncedContent } })
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

  const renderDocTree = (docs: Document[], level = 0) => {
    return docs.map((doc) => (
      <div key={doc.id} style={{ marginLeft: level * 16 }}>
        <div
          className={`flex items-center gap-1 p-2 rounded-md cursor-pointer hover:bg-accent ${
            selectedDoc?.id === doc.id ? 'bg-accent' : ''
          }`}
          onClick={() => setSelectedDoc(doc)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(doc.id)
            }}
            className="p-0.5"
          >
            {expandedDocs.has(doc.id) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {doc.doc_type === 'folder' ? (
            <Folder className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 text-sm truncate">{doc.title}</span>
          <span className="text-xs text-muted-foreground">{doc.word_count}w</span>
        </div>
        {expandedDocs.has(doc.id) && doc.children && renderDocTree(doc.children, level + 1)}
      </div>
    ))
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
          onClick={() => setShowNewDocForm(!showNewDocForm)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" />
          New Note
        </button>
      </div>

      {showNewDocForm && (
        <form onSubmit={handleCreateDoc} className="p-4 bg-card rounded-lg border space-y-3">
          <div className="flex gap-2">
            <input
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Note title"
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
        {/* Document tree */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            Notes
          </h2>
          <div className="space-y-1">
            {notes && notes.length > 0 ? (
              renderDocTree(notes)
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No notes yet
              </p>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className={`${sidebarCollapsed ? 'lg:col-span-10' : 'lg:col-span-7'} bg-card rounded-lg border flex flex-col overflow-hidden`}>
          {selectedDoc ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-3 border-b">
                <input
                  value={selectedDoc.title}
                  onChange={(e) => {
                    const updated = { ...selectedDoc, title: e.target.value }
                    setSelectedDoc(updated)
                    updateDocMutation.mutate({ id: selectedDoc.id, data: { title: e.target.value } })
                  }}
                  className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 flex-1"
                />
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
                    const doc = notes.find((d) => d.id === docId)
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
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a note to start writing</p>
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
            onCollapseChange={setSidebarCollapsed}
          />
        </div>
      </div>
    </div>
  )
}
