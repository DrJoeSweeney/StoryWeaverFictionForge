import { useState, useRef } from 'react'
import type { TipTapEditorRef } from '@/components/editor/TipTapEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Plus, User, Trash2, History, ChevronRight } from 'lucide-react'
import TipTapEditor from '@/components/editor/TipTapEditor'
import AIWritingSidebar from '@/components/writing/AIWritingSidebar'
import { useProjectTags } from '@/hooks/useProjectTags'

interface ProjectDocument {
  id: string
  title: string
  content: string
}

interface Character {
  id: string
  name: string
  aliases: string | null
  role: string
  archetype: string | null
  age: string | null
  appearance: string | null
  personality: string | null
  background: string | null
  goals: string | null
  conflicts: string | null
  voice_description: string | null
  notes: string | null
}

interface CharacterHistory {
  id: string
  event_title: string
  event_description: string | null
  timestamp_in_story: string | null
}

interface ActiveField {
  label: string
  value: string
  onUpdate: (v: string) => void
}

const ROLES = ['protagonist', 'antagonist', 'supporting', 'minor']

export default function CharactersPage({ projectId }: { projectId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [selectedChar, setSelectedChar] = useState<Character | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [formData, setFormData] = useState({
    name: '', role: 'supporting', archetype: '', age: '', appearance: '',
    personality: '', background: '', goals: '', conflicts: '', voice_description: '', notes: ''
  })
  const [historyForm, setHistoryForm] = useState({ event_title: '', event_description: '', timestamp_in_story: '' })
  const [activeField, setActiveField] = useState<ActiveField | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const textareaSelectionRef = useRef<{ value: string; setValue: (v: string) => void; selectionStart: number; selectionEnd: number } | null>(null)
  const notesEditorRef = useRef<TipTapEditorRef>(null)
  const queryClient = useQueryClient()

  const { data: characters, isLoading } = useQuery({
    queryKey: ['characters', projectId],
    queryFn: async () => {
      const res = await api.get<Character[]>(`/characters/project/${projectId}`)
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

  const { data: history } = useQuery({
    queryKey: ['character-history', selectedChar?.id],
    queryFn: async () => {
      if (!selectedChar) return []
      const res = await api.get<CharacterHistory[]>(`/characters/${selectedChar.id}/history`)
      return res.data
    },
    enabled: !!selectedChar && showHistory,
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post(`/characters/project/${projectId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] })
      setShowForm(false)
      setFormData({ name: '', role: 'supporting', archetype: '', age: '', appearance: '',
        personality: '', background: '', goals: '', conflicts: '', voice_description: '', notes: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Character> }) =>
      api.put(`/characters/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] })
      if (selectedChar) queryClient.invalidateQueries({ queryKey: ['character', selectedChar.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/characters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] })
      setSelectedChar(null)
      setActiveField(null)
    },
  })

  const addHistoryMutation = useMutation({
    mutationFn: (data: typeof historyForm) =>
      api.post(`/characters/${selectedChar!.id}/history`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-history', selectedChar?.id] })
      setHistoryForm({ event_title: '', event_description: '', timestamp_in_story: '' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    createMutation.mutate(formData)
  }

  const handleInsertText = (text: string) => {
    // If notes editor is focused, use it
    if (notesEditorRef.current?.isFocused()) {
      const sel = notesEditorRef.current.getSelectionInfo()
      if (sel && !sel.empty) {
        notesEditorRef.current.replaceSelection(text)
      } else {
        notesEditorRef.current.insertAtCursor(text)
      }
      notesEditorRef.current.focus()
      return
    }
    const sel = textareaSelectionRef.current
    if (!sel) {
      // Fallback: append if no selection captured
      if (activeField) activeField.onUpdate(activeField.value + '\n\n' + text)
      return
    }
    const { value, setValue, selectionStart, selectionEnd } = sel
    const before = value.substring(0, selectionStart)
    const after = value.substring(selectionEnd)
    const newValue = before + text + after
    setValue(newValue)
    textareaSelectionRef.current = null
  }

  if (isLoading) return <div className="text-center py-12">Loading characters...</div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)]">
      {/* Character list */}
      <div className="lg:col-span-2 bg-card rounded-lg border p-4 overflow-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
            Characters
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded-md text-sm"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="p-3 bg-background rounded-lg border space-y-2">
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Character name"
              className="w-full px-2 py-1 border rounded bg-background text-sm"
              required
            />
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-2 py-1 border rounded bg-background text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs">Add</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 border rounded text-xs">Cancel</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {characters?.map((char) => (
            <button
              key={char.id}
              onClick={() => { setSelectedChar(char); setShowHistory(false); setActiveField(null) }}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedChar?.id === char.id ? 'bg-accent border-primary' : 'bg-background hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{char.name}</span>
                <span className="text-xs px-2 py-0.5 bg-secondary rounded-full ml-auto">{char.role}</span>
              </div>
            </button>
          ))}
        </div>

        {characters?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No characters yet. Create your first character.
          </div>
        )}
      </div>

      {/* Character detail */}
      <div className={`${sidebarCollapsed ? 'lg:col-span-10' : 'lg:col-span-7'} bg-card rounded-lg border p-4 overflow-auto`}>
        {selectedChar ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedChar.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${showHistory ? 'bg-primary text-primary-foreground' : 'border'}`}
                >
                  <History className="h-4 w-4" />
                  History
                </button>
                <button
                  onClick={() => deleteMutation.mutate(selectedChar.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showHistory ? (
              <div className="space-y-4">
                <form
                  onSubmit={(e) => { e.preventDefault(); addHistoryMutation.mutate(historyForm) }}
                  className="p-3 bg-background rounded-lg border space-y-2"
                >
                  <input
                    value={historyForm.event_title}
                    onChange={(e) => setHistoryForm({ ...historyForm, event_title: e.target.value })}
                    placeholder="Event title"
                    className="w-full px-2 py-1 border rounded bg-background text-sm"
                    required
                  />
                  <textarea
                    value={historyForm.event_description}
                    onChange={(e) => setHistoryForm({ ...historyForm, event_description: e.target.value })}
                    placeholder="Event description..."
                    className="w-full px-2 py-1 border rounded bg-background text-sm min-h-[60px]"
                  />
                  <input
                    value={historyForm.timestamp_in_story}
                    onChange={(e) => setHistoryForm({ ...historyForm, timestamp_in_story: e.target.value })}
                    placeholder="Story timestamp (e.g., Chapter 3)"
                    className="w-full px-2 py-1 border rounded bg-background text-sm"
                  />
                  <button type="submit" className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs">
                    Add Event
                  </button>
                </form>

                <div className="space-y-2">
                  {history?.map((h) => (
                    <div key={h.id} className="p-3 bg-background rounded-lg border">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{h.event_title}</span>
                        {h.timestamp_in_story && (
                          <span className="text-xs text-muted-foreground ml-auto">{h.timestamp_in_story}</span>
                        )}
                      </div>
                      {h.event_description && (
                        <p className="text-sm text-muted-foreground mt-1">{h.event_description}</p>
                      )}
                    </div>
                  ))}
                  {history?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No history events yet</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <CharacterField label="Role" value={selectedChar.role} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { role: v } })} options={ROLES} />
                <CharacterField label="Archetype" value={selectedChar.archetype || ''} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { archetype: v } })} />
                <CharacterField label="Age" value={selectedChar.age || ''} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { age: v } })} />
                <CharacterTextArea label="Appearance" value={selectedChar.appearance || ''} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { appearance: v } })} onFocus={setActiveField} onSelectionChange={(s) => { textareaSelectionRef.current = s }} />
                <CharacterTextArea label="Personality" value={selectedChar.personality || ''} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { personality: v } })} onFocus={setActiveField} onSelectionChange={(s) => { textareaSelectionRef.current = s }} />
                <CharacterTextArea label="Background" value={selectedChar.background || ''} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { background: v } })} onFocus={setActiveField} onSelectionChange={(s) => { textareaSelectionRef.current = s }} />
                <CharacterTextArea label="Goals" value={selectedChar.goals || ''} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { goals: v } })} onFocus={setActiveField} onSelectionChange={(s) => { textareaSelectionRef.current = s }} />
                <CharacterTextArea label="Conflicts" value={selectedChar.conflicts || ''} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { conflicts: v } })} onFocus={setActiveField} onSelectionChange={(s) => { textareaSelectionRef.current = s }} />
                <CharacterTextArea label="Voice Description" value={selectedChar.voice_description || ''} onChange={(v) => updateMutation.mutate({ id: selectedChar.id, data: { voice_description: v } })} onFocus={setActiveField} onSelectionChange={(s) => { textareaSelectionRef.current = s }} />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <div className="border rounded bg-background min-h-[160px] flex flex-col">
                    <TipTapEditor
                      ref={notesEditorRef}
                      content={selectedChar.notes || ''}
                      onChange={(content) => {
                        updateMutation.mutate({ id: selectedChar.id, data: { notes: content } })
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
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a character to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* AI Sidebar */}
      <div className={`${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} overflow-hidden rounded-lg border`}>
        <AIWritingSidebar
          getSelectedText={() => {
            if (notesEditorRef.current?.isFocused()) {
              return notesEditorRef.current.getSelectionInfo()?.text || ''
            }
            return textareaSelectionRef.current?.value.substring(textareaSelectionRef.current.selectionStart, textareaSelectionRef.current.selectionEnd) || ''
          }}
          getFullContext={() => {
            if (notesEditorRef.current?.isFocused()) {
              return notesEditorRef.current.getContent()
            }
            return activeField?.value || ''
          }}
          onInsert={handleInsertText}
          projectId={projectId}
          onCollapseChange={setSidebarCollapsed}
        />
      </div>
    </div>
  )
}

function CharacterField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options?: string[] }) {
  const [editValue, setEditValue] = useState(value)
  const [editing, setEditing] = useState(false)

  if (editing) {
    if (options) {
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">{label}</label>
          <select
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); onChange(e.target.value); setEditing(false) }}
            className="w-full px-2 py-1 border rounded bg-background text-sm"
          >
            {options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
      )
    }
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => { onChange(editValue); setEditing(false) }}
          autoFocus
          className="w-full px-2 py-1 border rounded bg-background text-sm"
        />
      </div>
    )
  }

  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer hover:bg-accent p-2 rounded -m-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <p className="text-sm">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
    </div>
  )
}

function CharacterTextArea({ label, value, onChange, onFocus, onSelectionChange }: { label: string; value: string; onChange: (v: string) => void; onFocus: (field: { label: string; value: string; onUpdate: (v: string) => void }) => void; onSelectionChange?: (sel: { value: string; setValue: (v: string) => void; selectionStart: number; selectionEnd: number }) => void }) {
  const [editValue, setEditValue] = useState(value)
  const [editing, setEditing] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const handleFocus = () => {
    onFocus({ label, value: editValue, onUpdate: (v: string) => { setEditValue(v); onChange(v) } })
  }

  const reportSelection = () => {
    if (taRef.current && onSelectionChange) {
      onSelectionChange({
        value: editValue,
        setValue: (v: string) => { setEditValue(v); onChange(v) },
        selectionStart: taRef.current.selectionStart,
        selectionEnd: taRef.current.selectionEnd,
      })
    }
  }

  if (editing) {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <textarea
          ref={taRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => { reportSelection(); onChange(editValue); setEditing(false) }}
          onMouseUp={reportSelection}
          onKeyUp={reportSelection}
          onFocus={handleFocus}
          autoFocus
          className="w-full px-2 py-1 border rounded bg-background text-sm min-h-[120px]"
        />
      </div>
    )
  }

  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer hover:bg-accent p-2 rounded -m-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <p className="text-sm whitespace-pre-wrap">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
    </div>
  )
}
