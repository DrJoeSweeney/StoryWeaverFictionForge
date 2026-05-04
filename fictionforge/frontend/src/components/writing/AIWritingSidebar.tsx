import { useRef, useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAIWriting } from '@/hooks/useAIWriting'
import { useModelPreferences } from '@/hooks/useModelPreferences'
import api from '@/api/client'
import AgenticStatus from './AgenticStatus'
import SpeechMicButton from '@/components/SpeechMicButton'
import {
  Wand2, Sparkles, RefreshCw, Type, ArrowRight,
  Loader2, Check, Zap, BookOpen,
  MessageSquare, Trash2,
  Brain, Feather, Globe, Eye, Code, ScrollText, ChevronDown,
  Music, Image, Star, AlertTriangle,
  Pen, Pencil, Highlighter, Search, List, ListOrdered,
  FileText, Heart, Flame, Moon, Sun, Cloud, TreePine,
  Mountain, Anchor, Sword, Shield, Crown, Gem, Key,
  Lock, Unlock, User
} from 'lucide-react'

interface AIWritingSidebarProps {
  getSelectedText: () => string
  getFullContext: () => string
  onInsert: (text: string) => void
  onAppend?: (text: string) => void
  projectId?: string
  currentDocumentId?: string
  currentDocumentTitle?: string
  currentDocumentType?: string
  currentDocumentCategory?: string
  currentFieldName?: string
  moduleName?: string
}

const FALLBACK_ACTIONS = [
  { id: 'continue', label: 'Continue', icon: ArrowRight, description: 'Continue from here' },
  { id: 'rewrite', label: 'Rewrite', icon: RefreshCw, description: 'Rephrase selection' },
  { id: 'describe', label: 'Describe', icon: Type, description: 'Add vivid detail' },
  { id: 'shorten', label: 'Shorten', icon: Zap, description: 'Make it concise' },
  { id: 'expand', label: 'Expand', icon: Sparkles, description: 'Add depth' },
]

const ICON_MAP: Record<string, React.ElementType> = {
  ArrowRight, RefreshCw, Type, Zap, Sparkles, Feather, BookOpen, ScrollText,
  Wand2, Brain, Globe, Eye, Code, Music, Image, Star, MessageSquare,
  Pen, Pencil, Highlighter, Search, List, ListOrdered,
  FileText, Heart, Flame, Moon, Sun, Cloud, TreePine,
  Mountain, Anchor, Sword, Shield, Crown, Gem, Key,
  Lock, Unlock, User
}

export default function AIWritingSidebar({ getSelectedText, getFullContext, onInsert, onAppend, projectId, currentDocumentId, currentDocumentTitle, currentDocumentType, currentDocumentCategory, currentFieldName, moduleName }: AIWritingSidebarProps) {
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null)
  const [quickActionError, setQuickActionError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const queryClient = useQueryClient()
  const cancelRef = useRef(false)
  const {
    action, setAction,
    customPrompt, setCustomPrompt,
    model, setModel,
    provider, setProvider,
    loading, setLoading,
    showSkills, setShowSkills,

    chatMessages, clearChat, setChatMessages,
    pendingPlan, setPendingPlan,
    creatingIndex, setCreatingIndex,
    generateDocumentContent,
    availableModels,
    skills,
    agenticGenerate,
    agenticExecute,
    applySkill,
    consultedDocs,
    interactionMode,
    generateOutlineContent,
    writeOutlineToText,
    executeSkill,
  } = useAIWriting()

  const { isHidden, isStarred } = useModelPreferences()

  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  // Textarea height resize state
  const [textareaHeight, setTextareaHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('ff_ai_textarea_height')
      return saved ? Math.max(60, Math.min(400, parseInt(saved, 10))) : 80
    } catch {
      return 80
    }
  })
  const [isResizingHeight, setIsResizingHeight] = useState(false)
  const textareaResizeStartY = useRef(0)
  const textareaResizeStartHeight = useRef(textareaHeight)

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, loading, pendingPlan, creatingIndex])

  // Close model dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentModelCapabilities = () => {
    const m = availableModels.find(m => m.id === model && m.provider === provider)
    return m?.capabilities || []
  }

  const handleGenerate = async () => {
    const result = await agenticGenerate(getSelectedText(), getFullContext(), projectId, currentDocumentType)
    if (typeof result === 'string' && result !== 'outline_to_text_confirmed') {
      // Outline content was generated — insert into current doc or create new
      if (currentDocumentId) {
        onInsert(result)
      } else if (projectId) {
        // Story bible context: create a story bible entry
        if (currentDocumentType === 'story_bible') {
          try {
            const title = currentDocumentTitle || result.split('\n')[0].slice(0, 60) || 'New Entry'
            const res = await api.post(`/story-bible/project/${projectId}`, {
              project_id: projectId,
              category: currentDocumentCategory || 'world',
              title,
              content: result,
              tags: '',
            })
            queryClient.invalidateQueries({ queryKey: ['world', projectId] })
            setChatMessages((prev) => [...prev, { role: 'assistant', content: `✅ Created story bible entry: **${res.data.title}**` }])
          } catch (err: any) {
            const msg = err.response?.data?.detail || err.message || 'Unknown error'
            setChatMessages((prev) => [...prev, { role: 'assistant', content: `❌ Failed to create story bible entry: ${msg}` }])
          }
          return
        }
        // Default: create a regular document
        try {
          const res = await api.post('/documents', {
            project_id: projectId,
            title: currentDocumentTitle || 'Outline',
            content: result,
            parent_id: null,
            doc_type: 'outline',
          })
          queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
          setChatMessages((prev) => [...prev, { role: 'assistant', content: `✅ Created new document: **${res.data.title || 'Outline'}**` }])
        } catch (err: any) {
          const msg = err.response?.data?.detail || err.message || 'Unknown error'
          setChatMessages((prev) => [...prev, { role: 'assistant', content: `❌ Failed to create document: ${msg}` }])
        }
      }
    } else if (result === 'outline_to_text_confirmed') {
      await writeOutlineToText(getFullContext(), projectId, onAppend)
    }
  }
  const handleApplySkill = (skillId: string) => applySkill(skillId, getSelectedText(), getFullContext(), projectId, currentDocumentTitle, moduleName)

  const parseCharacterProfile = (text: string): Record<string, string> | null => {
    const lines = text.split('\n')
    const result: Record<string, string> = {}
    let currentKey: string | null = null
    const keyPattern = /^([A-Z][A-Z_]*):\s*(.*)$/

    for (const line of lines) {
      const match = line.match(keyPattern)
      if (match) {
        currentKey = match[1].toLowerCase()
        result[currentKey] = match[2].trim()
      } else if (currentKey && line.trim()) {
        result[currentKey] += '\n' + line.trim()
      }
    }

    return Object.keys(result).length >= 3 ? result : null
  }

  const handleQuickAction = async (actionId: string) => {
    if (!model) return
    setAction(actionId)
    setShowSkills(false)
    setQuickActionLoading(actionId)
    setQuickActionError(null)
    try {
      const selectedText = getSelectedText()
      const fullContext = getFullContext()
      // Check if this is a skill ID
      const skill = (skills || []).find((s: any) => s.id === actionId)
      let text: string
      if (skill && skill.is_agentic) {
        text = await executeSkill(actionId, selectedText, fullContext, projectId, currentDocumentType, currentFieldName, currentDocumentTitle, moduleName)
      } else {
        text = await agenticExecute(actionId, selectedText, fullContext, projectId, currentDocumentType, currentFieldName)
      }

      // Entity creation mode: create characters, story bible entries, or notes from selected text
      if (projectId && skill?.action) {
        // Create Character from any document type
        if (skill.action === 'create_character') {
          const profile = parseCharacterProfile(text)
          const charName = (profile?.name || selectedText || 'New Character').trim()
          const payload = {
            name: charName,
            role: ['protagonist', 'antagonist', 'supporting', 'minor'].includes(profile?.role || '')
              ? profile!.role
              : 'supporting',
            archetype: profile?.archetype || '',
            age: profile?.age || '',
            aliases: profile?.aliases || '',
            appearance: profile?.appearance || '',
            personality: profile?.personality || '',
            background: profile?.background || '',
            goals: profile?.goals || '',
            conflicts: profile?.conflicts || '',
            voice_description: profile?.voice_description || '',
            notes: profile?.notes || text,
          }
          const res = await api.post(`/characters/project/${projectId}`, payload)
          queryClient.invalidateQueries({ queryKey: ['characters', projectId] })
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `✅ Created character: **${res.data.name}**\n\n${payload.appearance ? '**Appearance:** ' + payload.appearance.slice(0, 120) + '...' : ''}` },
          ])
          return
        }

        // Create Story Bible Entry from any document type
        if (skill.action === 'create_story_bible') {
          const title = (selectedText || text.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60) || 'New Entry').trim()
          const res = await api.post(`/story-bible/project/${projectId}`, {
            project_id: projectId,
            category: currentDocumentCategory || 'world',
            title,
            content: text,
            tags: '',
          })
          queryClient.invalidateQueries({ queryKey: ['world', projectId] })
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `✅ Created story bible entry: **${res.data.title}**` },
          ])
          return
        }

        // Create Note from any document type
        if (skill.action === 'create_note') {
          const title = (selectedText || text.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60) || 'New Note').trim()
          const res = await api.post('/documents', {
            project_id: projectId,
            title,
            content: text,
            parent_id: null,
            doc_type: 'note',
          })
          queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `✅ Created note: **${res.data.title || title}**` },
          ])
          return
        }
      }

      onInsert(text)
    } catch (err: any) {
      setQuickActionError(err.message || 'Failed to generate')
    } finally {
      setQuickActionLoading(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handleCreateDocuments = async () => {
    if (!pendingPlan || !projectId || isCreating) return

    console.log('[DocCreate] Starting creation of', pendingPlan.documents.length, 'documents')
    setIsCreating(true)
    cancelRef.current = false
    setPendingPlan(null)

    const docs = pendingPlan.documents
    const fullContext = getFullContext()
    let successCount = 0

    for (let i = 0; i < docs.length; i++) {
      if (cancelRef.current) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '⏹️ Document creation cancelled by user.' }])
        break
      }

      const doc = docs[i]
      setCreatingIndex(i)
      setChatMessages(prev => [...prev, { role: 'assistant', content: `⏳ Creating **${doc.title}**...` }])

      try {
        console.log('[DocCreate] Generating content for:', doc.title)
        setLoading(true)
        const content = await generateDocumentContent(doc, fullContext, projectId)
        setLoading(false)
        console.log('[DocCreate] Content generated, saving document:', doc.title, 'length:', content?.length)

        if (cancelRef.current) {
          setChatMessages(prev => [...prev, { role: 'assistant', content: '⏹️ Cancelled before saving.' }])
          break
        }

        // Show preview before saving
        const preview = content.length > 300 ? content.slice(0, 300) + '...' : content
        setChatMessages(prev => [...prev, { role: 'assistant', content: `**${doc.title}** — Preview:\n\n${preview}\n\n---\n_Saving..._` }])

        // Story bible context: create story bible entries
        if (currentDocumentType === 'story_bible') {
          const saveRes = await api.post(`/story-bible/project/${projectId}`, {
            project_id: projectId,
            category: currentDocumentCategory || doc.doc_type || 'world',
            title: doc.title,
            content: content,
            tags: '',
          })
          console.log('[DocCreate] Story bible entry saved:', saveRes.data?.id)
          queryClient.invalidateQueries({ queryKey: ['world', projectId] })
          successCount++
          setChatMessages(prev => [...prev, { role: 'assistant', content: `✅ Saved **${doc.title}**` }])
          continue
        }

        const saveRes = await api.post('/documents', {
          project_id: projectId,
          title: doc.title,
          content: content,
          parent_id: null,
          doc_type: doc.doc_type || 'chapter',
        })
        console.log('[DocCreate] Document saved:', saveRes.data?.id)
        queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
        successCount++
        setChatMessages(prev => [...prev, { role: 'assistant', content: `✅ Saved **${doc.title}**` }])
      } catch (err: any) {
        setLoading(false)
        const detail = err.response?.data?.detail
        const errorMsg = typeof detail === 'string' ? detail : err.message || 'Unknown error'
        console.error('[DocCreate] Failed for', doc.title, ':', errorMsg, err)
        setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Failed to create **${doc.title}**: ${errorMsg}` }])
      }
    }

    setCreatingIndex(-1)
    setIsCreating(false)
    cancelRef.current = false
    if (!cancelRef.current) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Done! Created ${successCount}/${docs.length} document(s).` }])
    }
    console.log('[DocCreate] Finished. Success:', successCount, '/', docs.length)
  }

  const handleCancelCreation = () => {
    cancelRef.current = true
    setChatMessages(prev => [...prev, { role: 'assistant', content: '⏹️ Cancelling after current document...' }])
  }

  const handleCancelPlan = () => {
    setPendingPlan(null)
    setChatMessages(prev => [...prev, { role: 'assistant', content: 'Document creation cancelled.' }])
  }

  const handleTextareaResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingHeight(true)
    textareaResizeStartY.current = e.clientY
    textareaResizeStartHeight.current = textareaHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = textareaResizeStartY.current - moveEvent.clientY
      const newHeight = Math.max(60, Math.min(400, textareaResizeStartHeight.current + delta))
      setTextareaHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizingHeight(false)
      try {
        localStorage.setItem('ff_ai_textarea_height', String(textareaHeight))
      } catch { /* ignore */ }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [textareaHeight])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between shrink-0">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          AI Assistant
        </h3>
        <div className="flex items-center gap-1">
          {chatMessages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-3 space-y-3 shrink-0 border-b">
        {/* Model selection */}
        <div className="space-y-1" ref={modelDropdownRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Model</label>
            <div className="flex items-center gap-1.5">
              {provider && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  provider === 'openrouter' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  provider === 'anthropic' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                  provider === 'google' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  provider === 'moonshot' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </span>
              )}
              {currentModelCapabilities().map(cap => (
                <CapabilityIcon key={cap} capability={cap} className="h-3 w-3 text-muted-foreground" />
              ))}
              <TrainingIcon trainsOnData={availableModels.find(m => m.id === model && m.provider === provider)?.trains_on_data} className="text-muted-foreground" />
              <CostTierIcon tier={availableModels.find(m => m.id === model && m.provider === provider)?.cost_tier} className="text-muted-foreground" />
            </div>
          </div>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="w-full px-2 py-1.5 border rounded-md bg-background text-sm flex items-center justify-between hover:bg-accent/50"
          >
            <span className="truncate">
              {(() => {
                const m = availableModels.find(m => m.id === model && m.provider === provider)
                if (!m) return 'Select model...'
                return m.real_provider ? `${m.name} (${m.real_provider})` : m.name
              })()}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {modelDropdownOpen && (
            <div className="border rounded-md bg-background shadow-lg max-h-60 overflow-y-auto">
              {availableModels.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No models — add API key in Configuration</div>
              )}
              {(() => {
                const visible = availableModels.filter(m => !isHidden(m.id))
                const starred = visible.filter(m => isStarred(m.id)).sort((a, b) => a.name.localeCompare(b.name))
                const unstarred = visible.filter(m => !isStarred(m.id))
                // Group unstarred by real provider, sorted alphabetically
                const grouped = unstarred.reduce((acc, m) => {
                  const groupKey = (m as any).real_provider || m.provider
                  if (!acc[groupKey]) acc[groupKey] = []
                  acc[groupKey].push(m)
                  return acc
                }, {} as Record<string, typeof availableModels>)
                Object.values(grouped).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)))
                const groupedEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
                return (
                  <>
                    {starred.length > 0 && (
                      <div>
                        <div className="px-3 py-1 text-[10px] font-semibold text-yellow-600 uppercase tracking-wider bg-yellow-50 dark:bg-yellow-900/20 sticky top-0 flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          Starred
                        </div>
                        {starred.map((m) => (
                          <ModelDropdownItem
                            key={m.id}
                            m={m}
                            selected={m.id === model && m.provider === provider}
                            onSelect={() => {
                              setProvider(m.provider)
                              setModel(m.id)
                              setModelDropdownOpen(false)
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {groupedEntries.map(([prov, models]) => (
                      <div key={prov}>
                        <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/50 sticky top-0">
                          {prov}
                        </div>
                        {models.map((m) => (
                          <ModelDropdownItem
                            key={m.id}
                            m={m}
                            selected={m.id === model && m.provider === provider}
                            onSelect={() => {
                              setProvider(m.provider)
                              setModel(m.id)
                              setModelDropdownOpen(false)
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Style Guide toggle */}
        {/* Quick action icons — driven by agentic agents */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Quick Actions</label>
          <div className="flex items-center gap-1 flex-wrap">
            {(skills || []).filter((s: any) => s.is_quick_action).length > 0 ? (
              (skills || []).filter((s: any) => s.is_quick_action).slice(0, 8).map((skill: any) => {
                const isLoading = quickActionLoading === skill.id
                const isActive = action === skill.action
                const Icon = ICON_MAP[skill.icon] || Zap
                return (
                  <button
                    key={skill.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleQuickAction(skill.id)}
                    disabled={isLoading || !model}
                    title={skill.description || skill.name}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-muted-foreground'
                    } disabled:opacity-50`}
                  >
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-4 w-4" />}
                  </button>
                )
              })
            ) : (
              FALLBACK_ACTIONS.map((act) => {
                const Icon = act.icon
                const isActive = action === act.id
                const isLoading = quickActionLoading === act.id
                return (
                  <button
                    key={act.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleQuickAction(act.id)}
                    disabled={isLoading || !model}
                    title={act.description}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-muted-foreground'
                    } disabled:opacity-50`}
                  >
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-4 w-4" />}
                  </button>
                )
              })
            )}
          </div>
          {quickActionError && (
            <p className="text-xs text-red-600">{quickActionError}</p>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
      >
        {chatMessages.length === 0 && !loading && (
          <div className="text-center text-muted-foreground text-xs py-8">
            <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Start writing with AI</p>
            <p className="mt-1">Use quick actions or type a prompt below</p>
            <p className="mt-1 opacity-60">Type /clear to reset chat</p>
            <p className="mt-1 opacity-60">Type /plan to plan new documents</p>
            <p className="mt-1 opacity-60">Or say: "Write 3 new chapters"</p>
          </div>
        )}

        {chatMessages.map((msg, index) => {
          if (msg.role === 'user') {
            return (
              <div key={index} className="flex justify-end">
                <div className="max-w-[90%] bg-primary/10 rounded-lg px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            )
          }
          // assistant
          const isError = msg.content.startsWith('Error:') || msg.content.startsWith('❌')
          const isProgress = msg.content.startsWith('⏳') || msg.content.startsWith('✅')
          return (
            <div key={index} className="flex justify-start">
              <div className="max-w-[95%] w-full space-y-1">
                <div className={`rounded-lg px-3 py-2 text-sm ${isError ? 'bg-red-50 text-red-700' : isProgress ? 'bg-blue-50 text-blue-800' : 'bg-background border'}`}>
                  <div className="whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                </div>
                {!isError && !isProgress && !msg.content.startsWith('Done!') && !msg.content.includes('cancelled') && (
                  <div className="flex gap-1 justify-end">
                    {msg.isPlan && pendingPlan ? (
                      <>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleCreateDocuments}
                          disabled={isCreating}
                          className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                          Yes
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleCancelPlan}
                          disabled={isCreating}
                          className="flex items-center gap-1 px-2 py-1 border rounded text-xs hover:bg-accent disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : interactionMode === 'outline_creation_pending' && index === chatMessages.length - 1 && msg.role === 'assistant' ? (
                      <>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={async () => {
                            const outlineText = await generateOutlineContent(getFullContext(), projectId)
                            if (outlineText) {
                              if (currentDocumentId) {
                                onInsert(outlineText)
                              } else if (projectId) {
                                try {
                                  const res = await api.post('/documents', {
                                    project_id: projectId,
                                    title: currentDocumentTitle || 'Outline',
                                    content: outlineText,
                                    parent_id: null,
                                    doc_type: 'outline',
                                  })
                                  queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
                                  setChatMessages((prev) => [...prev, { role: 'assistant', content: `✅ Created new document: **${res.data.title || 'Outline'}**` }])
                                } catch (err: any) {
                                  const msgErr = err.response?.data?.detail || err.message || 'Unknown error'
                                  setChatMessages((prev) => [...prev, { role: 'assistant', content: `❌ Failed to create document: ${msgErr}` }])
                                }
                              }
                            }
                          }}
                          disabled={loading}
                          className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                          Yes
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            clearChat()
                          }}
                          disabled={loading}
                          className="flex items-center gap-1 px-2 py-1 border rounded text-xs hover:bg-accent disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </>
                    ) : interactionMode === 'outline_to_text_confirm' && index === chatMessages.length - 1 && msg.role === 'assistant' ? (
                      <>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={async () => {
                            await writeOutlineToText(getFullContext(), projectId, onAppend)
                          }}
                          disabled={loading}
                          className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                          Yes
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            clearChat()
                          }}
                          disabled={loading}
                          className="flex items-center gap-1 px-2 py-1 border rounded text-xs hover:bg-accent disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onInsert(msg.content)}
                        className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                      >
                        <Check className="h-3 w-3" />
                        Insert
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-background border rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Writing...
              {isCreating && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCancelCreation}
                  className="ml-2 px-2 py-0.5 text-[10px] border rounded hover:bg-accent text-red-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Consulted documents */}
        {consultedDocs.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-[95%] w-full text-xs text-muted-foreground">
              <span className="font-medium">Consulted:</span>{' '}
              {consultedDocs.map((d, i) => (
                <span key={i}>
                  {d.title}
                  {i < consultedDocs.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Consulted documents — only shows when agentic AI fetched project docs */}
      <AgenticStatus consultedDocs={consultedDocs} />

      {/* Input area */}
      <div className="p-3 space-y-2 shrink-0 border-t">
        {/* Height resize handle */}
        <div
          onMouseDown={handleTextareaResizeStart}
          className={`
            h-1.5 cursor-ns-resize flex items-center justify-center
            hover:bg-accent/60 rounded-t
            ${isResizingHeight ? 'bg-accent/80' : ''}
            group
          `}
          title="Drag to resize height"
        >
          <div className={`
            w-4 h-px
            ${isResizingHeight ? 'bg-primary' : 'bg-border group-hover:bg-primary/50'}
            transition-colors
          `} />
        </div>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What would you like the AI to do? Type /clear to reset chat."
          style={{ height: textareaHeight }}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex gap-2">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleGenerate}
            disabled={loading || !model}
            className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {loading ? 'Writing...' : 'Send'}
          </button>
          <SpeechMicButton
            onTranscript={(text) => setCustomPrompt((prev) => prev + (prev ? ' ' : '') + text)}
            className="px-3 py-2 border rounded-md"
            title="Speech to text"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowSkills(!showSkills)}
            className="px-3 py-2 border rounded-md text-sm hover:bg-accent"
            title="Agents"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>

        {showSkills && (
          <div className="mt-1 space-y-1 max-h-32 overflow-auto">
            {skills?.map((skill: any) => (
              <button
                key={skill.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleApplySkill(skill.id)}
                className="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-accent truncate"
              >
                {skill.name}
              </button>
            ))}
            {skills?.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-1">No agents yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ModelDropdownItem({ m, selected, onSelect }: { m: any; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={`w-full px-3 py-2 text-sm flex items-center justify-between hover:bg-accent ${
        selected ? 'bg-primary/10 text-primary' : ''
      }`}
    >
      <span className="truncate flex items-center gap-1">
        {m.real_provider ? `${m.name} (${m.real_provider})` : m.name}
      </span>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {m.capabilities?.map((cap: string) => (
          <CapabilityIcon key={cap} capability={cap} className="h-3 w-3 text-muted-foreground" />
        ))}
        <TrainingIcon trainsOnData={m.trains_on_data} className="text-muted-foreground" />
        <CostTierIcon tier={m.cost_tier} className="text-muted-foreground" />
      </div>
    </button>
  )
}

function TrainingIcon({ trainsOnData, className = '' }: { trainsOnData?: boolean; className?: string }) {
  if (!trainsOnData) return null
  return <span title="May use data for training"><AlertTriangle className={`h-3 w-3 text-amber-500 ${className}`} /></span>
}

function CostTierIcon({ tier, className = '' }: { tier?: string; className?: string }) {
  if (!tier) return null
  const labels: Record<string, string> = {
    free: 'Free',
    cheap: 'Cheap',
    mid: 'Mid',
    expensive: 'Expensive',
  }
  const colors: Record<string, string> = {
    free: 'text-blue-500',
    cheap: 'text-green-500',
    mid: 'text-yellow-500',
    expensive: 'text-red-500',
  }
  const text = (() => {
    switch (tier) {
      case 'free': return '̶$̶'
      case 'cheap': return '$'
      case 'mid': return '$$'
      case 'expensive': return '$$$'
      default: return null
    }
  })()
  if (!text) return null
  return (
    <span title={labels[tier] || tier} className={`text-[10px] font-bold tabular-nums ${colors[tier] || 'text-muted-foreground'} ${className}`}>
      {text}
    </span>
  )
}

function CapabilityIcon({ capability, className }: { capability: string; className?: string }) {
  const titles: Record<string, string> = {
    reasoning: 'Reasoning',
    writing: 'Writing',
    web_search: 'Web Search',
    vision: 'Vision',
    coding: 'Coding',
    long_context: 'Long Context',
    audio: 'Audio',
    image: 'Image',
  }
  const icon = (() => {
    switch (capability) {
      case 'reasoning': return <Brain className={className} />
      case 'writing': return <Feather className={className} />
      case 'web_search': return <Globe className={className} />
      case 'vision': return <Eye className={className} />
      case 'coding': return <Code className={className} />
      case 'long_context': return <ScrollText className={className} />
      case 'audio': return <Music className={className} />
      case 'image': return <Image className={className} />
      default: return null
    }
  })()
  if (!icon) return null
  return <span title={titles[capability] || capability}>{icon}</span>
}

// Simple markdown renderer for plan text
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```[\s\S]*?```/g, (m) => `<pre class="bg-secondary p-2 rounded text-xs overflow-auto">${m.slice(3, -3)}</pre>`)
    .replace(/`(.*?)`/g, '<code class="bg-secondary px-1 rounded text-xs">$1</code>')
    .replace(/\n/g, '<br/>')
}
