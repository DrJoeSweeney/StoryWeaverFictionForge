import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Plus, Trash2, Route, Target, Wand2, Loader2 } from 'lucide-react'
import AIWritingSidebar from '@/components/writing/AIWritingSidebar'

interface StoryBeat {
  id: string
  title: string
  description: string | null
  act_number: number
  position: number
  target_word_count: number | null
  document_id: string | null
}

interface StoryOutline {
  id: string
  title: string
  structure_type: string
  beats: StoryBeat[]
}

const STRUCTURES = ['three-act', 'hero-journey', 'save-the-cat', 'freytag', 'custom']

function getStructureLabel(s: string) {
  return s.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export default function StoryEnginePage({ projectId }: { projectId: string }) {
  const [showOutlineForm, setShowOutlineForm] = useState(false)
  const [selectedOutline, setSelectedOutline] = useState<StoryOutline | null>(null)
  const [outlineForm, setOutlineForm] = useState({ title: '', structure_type: 'three-act' })
  const [beatForm, setBeatForm] = useState({ title: '', description: '', act_number: 1, position: 0, target_word_count: '' })
  const [showBeatForm, setShowBeatForm] = useState(false)
  const [activeBeat, setActiveBeat] = useState<StoryBeat | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const textareaSelectionRef = useRef<{ value: string; setValue: (v: string) => void; selectionStart: number; selectionEnd: number } | null>(null)
  const queryClient = useQueryClient()

  const { data: outlines, isLoading } = useQuery({
    queryKey: ['outlines', projectId],
    queryFn: async () => {
      const res = await api.get<StoryOutline[]>(`/story-engine/project/${projectId}`)
      return res.data
    },
  })

  const createOutlineMutation = useMutation({
    mutationFn: (data: typeof outlineForm) => api.post(`/story-engine/project/${projectId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlines', projectId] })
      setShowOutlineForm(false)
      setOutlineForm({ title: '', structure_type: 'three-act' })
    },
  })

  const deleteOutlineMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/story-engine/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlines', projectId] })
      setSelectedOutline(null)
      setActiveBeat(null)
    },
  })

  const createBeatMutation = useMutation({
    mutationFn: (data: typeof beatForm) =>
      api.post(`/story-engine/${selectedOutline!.id}/beats`, {
        ...data,
        target_word_count: data.target_word_count ? parseInt(data.target_word_count) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlines', projectId] })
      setShowBeatForm(false)
      setBeatForm({ title: '', description: '', act_number: 1, position: 0, target_word_count: '' })
    },
  })

  const deleteBeatMutation = useMutation({
    mutationFn: (beatId: string) => api.delete(`/story-engine/beats/${beatId}`),
    onSuccess: (_data, beatId) => {
      queryClient.invalidateQueries({ queryKey: ['outlines', projectId] })
      if (activeBeat?.id === beatId) setActiveBeat(null)
    },
  })

  const updateBeatMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StoryBeat> }) =>
      api.put(`/story-engine/beats/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlines', projectId] })
    },
  })

  const handleCreateOutline = (e: React.FormEvent) => {
    e.preventDefault()
    if (!outlineForm.title.trim()) return
    createOutlineMutation.mutate(outlineForm)
  }

  const handleCreateBeat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!beatForm.title.trim() || !selectedOutline) return
    createBeatMutation.mutate(beatForm)
  }

  const handleInsertText = (text: string) => {
    const sel = textareaSelectionRef.current
    if (sel) {
      const { value, setValue, selectionStart, selectionEnd } = sel
      const before = value.substring(0, selectionStart)
      const after = value.substring(selectionEnd)
      const newValue = before + text + after
      setValue(newValue)
      textareaSelectionRef.current = null
    } else if (activeBeat && selectedOutline) {
      const newDescription = (activeBeat.description || '') + '\n\n' + text
      const updated = { ...activeBeat, description: newDescription }
      setActiveBeat(updated)
      updateBeatMutation.mutate({ id: activeBeat.id, data: { description: newDescription } })
    }
  }

  const getBeatContext = (beat: StoryBeat | null) => {
    if (!beat || !selectedOutline) return ''
    const outlineContext = `Outline: ${selectedOutline.title} (${selectedOutline.structure_type})\n\n`
    const beatContext = `Beat: ${beat.title} (Act ${beat.act_number}, Position ${beat.position})\n\nDescription:\n${beat.description || ''}`
    return outlineContext + beatContext
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
          onClick={() => setShowOutlineForm(!showOutlineForm)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" />
          New Outline
        </button>
      </div>

      {showOutlineForm && (
        <form onSubmit={handleCreateOutline} className="p-4 bg-card rounded-lg border space-y-3">
          <div className="flex gap-2">
            <input
              value={outlineForm.title}
              onChange={(e) => setOutlineForm({ ...outlineForm, title: e.target.value })}
              placeholder="Outline title"
              className="flex-1 px-3 py-2 border rounded-md bg-background"
              required
            />
            <select
              value={outlineForm.structure_type}
              onChange={(e) => setOutlineForm({ ...outlineForm, structure_type: e.target.value })}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              {STRUCTURES.map((s) => (
                <option key={s} value={s}>{getStructureLabel(s)}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={createOutlineMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)]">
        {/* Outline list */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            Outlines
          </h2>
          <div className="space-y-1">
            {outlines && outlines.length > 0 ? (
              outlines.map((outline) => (
                <div
                  key={outline.id}
                  className={`flex items-center gap-1 p-2 rounded-md cursor-pointer hover:bg-accent ${
                    selectedOutline?.id === outline.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    setSelectedOutline(selectedOutline?.id === outline.id ? null : outline)
                    setActiveBeat(null)
                  }}
                >
                  <Route className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm truncate">{outline.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 uppercase">
                    {outline.beats?.length || 0}b
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No outlines yet
              </p>
            )}
          </div>
        </div>

        {/* Outline detail / beats */}
        <div className={`${sidebarCollapsed ? 'lg:col-span-10' : 'lg:col-span-7'} bg-card rounded-lg border flex flex-col overflow-hidden`}>
          {selectedOutline ? (
            <div className="flex flex-col h-full">
              {/* Header bar */}
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs px-2 py-0.5 bg-secondary rounded-full uppercase tracking-wider">
                    {getStructureLabel(selectedOutline.structure_type)}
                  </span>
                  <span className="text-lg font-semibold">{selectedOutline.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowBeatForm(!showBeatForm)}
                    className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Add Beat
                  </button>
                  <button
                    onClick={() => deleteOutlineMutation.mutate(selectedOutline.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Beats content */}
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {showBeatForm && (
                  <form onSubmit={handleCreateBeat} className="p-3 bg-background rounded border space-y-2">
                    <input
                      value={beatForm.title}
                      onChange={(e) => setBeatForm({ ...beatForm, title: e.target.value })}
                      placeholder="Beat title"
                      className="w-full px-2 py-1 border rounded bg-background text-sm"
                      required
                    />
                    <textarea
                      value={beatForm.description}
                      onChange={(e) => setBeatForm({ ...beatForm, description: e.target.value })}
                      placeholder="Description"
                      className="w-full px-2 py-1 border rounded bg-background text-sm min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={beatForm.act_number}
                        onChange={(e) => setBeatForm({ ...beatForm, act_number: parseInt(e.target.value) || 1 })}
                        placeholder="Act"
                        className="w-20 px-2 py-1 border rounded bg-background text-sm"
                        min={1}
                      />
                      <input
                        type="number"
                        value={beatForm.position}
                        onChange={(e) => setBeatForm({ ...beatForm, position: parseInt(e.target.value) || 0 })}
                        placeholder="Position"
                        className="w-24 px-2 py-1 border rounded bg-background text-sm"
                        min={0}
                      />
                      <input
                        type="number"
                        value={beatForm.target_word_count}
                        onChange={(e) => setBeatForm({ ...beatForm, target_word_count: e.target.value })}
                        placeholder="Target words"
                        className="w-28 px-2 py-1 border rounded bg-background text-sm"
                      />
                      <button type="submit" className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs">
                        Add
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {selectedOutline.beats?.sort((a, b) => a.position - b.position).map((beat) => (
                    <div
                      key={beat.id}
                      className={`flex items-start gap-3 p-3 bg-background rounded border cursor-pointer transition-colors ${
                        activeBeat?.id === beat.id ? 'border-primary ring-1 ring-primary' : ''
                      }`}
                      onClick={() => setActiveBeat(activeBeat?.id === beat.id ? null : beat)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-xs font-bold shrink-0">
                        {beat.act_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-sm">{beat.title}</h5>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveBeat(beat) }}
                              className="p-1 text-muted-foreground hover:text-primary"
                              title="AI Assist"
                            >
                              <Wand2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteBeatMutation.mutate(beat.id) }}
                              className="p-0.5 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {activeBeat?.id === beat.id ? (
                          <BeatTextarea
                            beat={beat}
                            onChange={(description) => {
                              const updated = { ...beat, description }
                              setActiveBeat(updated)
                              updateBeatMutation.mutate({ id: beat.id, data: { description } })
                            }}
                            onSelectionChange={(sel) => { textareaSelectionRef.current = sel }}
                          />
                        ) : (
                          beat.description && (
                            <p className="text-sm text-muted-foreground mt-1">{beat.description}</p>
                          )
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {beat.target_word_count && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {beat.target_word_count} words
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!selectedOutline.beats || selectedOutline.beats.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No beats yet</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an outline to view beats</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Sidebar */}
        <div className={`${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} overflow-hidden rounded-lg border`}>
          <AIWritingSidebar
            getSelectedText={() => textareaSelectionRef.current?.value.substring(textareaSelectionRef.current.selectionStart, textareaSelectionRef.current.selectionEnd) || ''}
            getFullContext={() => getBeatContext(activeBeat)}
            onInsert={handleInsertText}
            projectId={projectId}
            currentDocumentType="outline"
            currentFieldName={activeBeat ? 'beat_description' : 'outline_content'}
            onCollapseChange={setSidebarCollapsed}
          />
        </div>
      </div>
    </div>
  )
}

function BeatTextarea({ beat, onChange, onSelectionChange }: { beat: StoryBeat; onChange: (description: string) => void; onSelectionChange: (sel: { value: string; setValue: (v: string) => void; selectionStart: number; selectionEnd: number }) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const value = beat.description || ''

  const reportSelection = () => {
    if (taRef.current) {
      onSelectionChange({
        value,
        setValue: onChange,
        selectionStart: taRef.current.selectionStart,
        selectionEnd: taRef.current.selectionEnd,
      })
    }
  }

  return (
    <textarea
      ref={taRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={reportSelection}
      onMouseUp={reportSelection}
      onKeyUp={reportSelection}
      placeholder="Beat description..."
      className="w-full mt-2 px-2 py-1 border rounded bg-background text-sm min-h-[100px]"
      autoFocus
    />
  )
}
