import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Plus, Trash2, Route, Target, Wand2 } from 'lucide-react'
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

  if (isLoading) return <div className="text-center py-12">Loading story engine...</div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Outlines list */}
      <div className={`${sidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-9'} space-y-6`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Route className="h-5 w-5" />
            Story Engine
          </h2>
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
                className="px-3 py-2 border rounded-md bg-background"
              >
                {STRUCTURES.map((s) => (
                  <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
              <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
                Create
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {outlines?.map((outline) => (
            <div key={outline.id} className="bg-card rounded-lg border">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50"
                onClick={() => {
                  setSelectedOutline(selectedOutline?.id === outline.id ? null : outline)
                  setActiveBeat(null)
                }}
              >
                <div>
                  <h3 className="font-semibold">{outline.title}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{outline.structure_type?.replace('-', ' ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{outline.beats?.length || 0} beats</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteOutlineMutation.mutate(outline.id) }}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {selectedOutline?.id === outline.id && (
                <div className="p-4 pt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Beats</h4>
                    <button
                      onClick={() => setShowBeatForm(!showBeatForm)}
                      className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                    >
                      <Plus className="h-3 w-3" />
                      Add Beat
                    </button>
                  </div>

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
                    {outline.beats?.sort((a, b) => a.position - b.position).map((beat) => (
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
                    {(!outline.beats || outline.beats.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No beats yet</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {outlines?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No story outlines yet</p>
              <p className="text-sm">Create an outline to plan your story structure</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Sidebar */}
      <div className={`${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} bg-card rounded-lg border overflow-hidden`}>
        <AIWritingSidebar
          getSelectedText={() => textareaSelectionRef.current?.value.substring(textareaSelectionRef.current.selectionStart, textareaSelectionRef.current.selectionEnd) || ''}
          getFullContext={() => getBeatContext(activeBeat)}
          onInsert={handleInsertText}
          projectId={projectId}
          onCollapseChange={setSidebarCollapsed}
        />
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
