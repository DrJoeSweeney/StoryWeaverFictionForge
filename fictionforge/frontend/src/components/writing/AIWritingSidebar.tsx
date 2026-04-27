import { useRef, useState, useEffect } from 'react'
import { useAIWriting } from '@/hooks/useAIWriting'
import api from '@/api/client'
import AgenticStatus from './AgenticStatus'
import SpeechMicButton from '@/components/SpeechMicButton'
import {
  Wand2, Sparkles, RefreshCw, Type, ArrowRight,
  ChevronLeft, Loader2, Check, Zap, BookOpen,
  MessageSquare, Trash2,
  Brain, Feather, Globe, Eye, Code, ScrollText, ChevronDown,
  Music, Image
} from 'lucide-react'

interface AIWritingSidebarProps {
  getSelectedText: () => string
  getFullContext: () => string
  onInsert: (text: string) => void
  projectId?: string
  currentDocumentId?: string
  onCollapseChange?: (collapsed: boolean) => void
}

const ACTIONS = [
  { id: 'continue', label: 'Continue', icon: ArrowRight, description: 'Continue from here' },
  { id: 'rewrite', label: 'Rewrite', icon: RefreshCw, description: 'Rephrase selection' },
  { id: 'describe', label: 'Describe', icon: Type, description: 'Add vivid detail' },
  { id: 'shorten', label: 'Shorten', icon: Zap, description: 'Make it concise' },
  { id: 'expand', label: 'Expand', icon: Sparkles, description: 'Add depth' },
]

export default function AIWritingSidebar({ getSelectedText, getFullContext, onInsert, projectId, currentDocumentId, onCollapseChange }: AIWritingSidebarProps) {
  const [isCollapsed, setIsCollapsedInternal] = useState(false)
  const setIsCollapsed = (v: boolean) => {
    setIsCollapsedInternal(v)
    onCollapseChange?.(v)
  }
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null)
  const [quickActionError, setQuickActionError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const cancelRef = useRef(false)
  const {
    action, setAction,
    customPrompt, setCustomPrompt,
    model, setModel,
    provider, setProvider,
    loading, setLoading,
    showSkills, setShowSkills,
    includeStyleGuide, setIncludeStyleGuide,
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
  } = useAIWriting()

  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

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

  const handleGenerate = () => agenticGenerate(getSelectedText(), getFullContext(), projectId)
  const handleApplySkill = (skillId: string) => applySkill(skillId, getSelectedText(), getFullContext(), projectId)

  const handleQuickAction = async (actionId: string) => {
    if (!model) return
    setAction(actionId)
    setShowSkills(false)
    setQuickActionLoading(actionId)
    setQuickActionError(null)
    try {
      const selectedText = getSelectedText()
      const fullContext = getFullContext()
      const text = await agenticExecute(actionId, selectedText, fullContext, projectId)
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

    // If a document is open and the plan has 1 document, rewrite the current document
    if (currentDocumentId && pendingPlan.documents.length === 1) {
      setIsCreating(true)
      cancelRef.current = false
      setPendingPlan(null)
      const doc = pendingPlan.documents[0]
      const fullContext = getFullContext()

      try {
        setLoading(true)
        const content = await generateDocumentContent(doc, fullContext, projectId)
        setLoading(false)

        if (cancelRef.current) {
          setChatMessages(prev => [...prev, { role: 'assistant', content: '⏹️ Cancelled.' }])
          setIsCreating(false)
          return
        }

        await api.put(`/documents/${currentDocumentId}`, { content })
        setChatMessages(prev => [...prev, { role: 'assistant', content: `✅ Updated **${doc.title}**` }])
      } catch (err: any) {
        setLoading(false)
        const detail = err.response?.data?.detail
        const errorMsg = typeof detail === 'string' ? detail : err.message || 'Unknown error'
        setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Failed to update **${doc.title}**: ${errorMsg}` }])
      } finally {
        setIsCreating(false)
        cancelRef.current = false
      }
      return
    }

    // Otherwise, create new documents as before
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

        const saveRes = await api.post('/documents', {
          project_id: projectId,
          title: doc.title,
          content: content,
          parent_id: null,
          doc_type: doc.doc_type || 'chapter',
        })
        console.log('[DocCreate] Document saved:', saveRes.data?.id)
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

  if (isCollapsed) {
    return (
      <div className="h-full w-10 flex flex-col items-center py-3 border-l bg-card shrink-0">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          title="Expand AI sidebar"
        >
          <Wand2 className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          title="Expand AI sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 bg-card border-l flex flex-col h-full">
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
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
            title="Collapse"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
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
            </div>
          </div>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="w-full px-2 py-1.5 border rounded-md bg-background text-sm flex items-center justify-between hover:bg-accent/50"
          >
            <span className="truncate">
              {availableModels.find(m => m.id === model && m.provider === provider)?.name || 'Select model...'}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {modelDropdownOpen && (
            <div className="border rounded-md bg-background shadow-lg max-h-60 overflow-y-auto">
              {availableModels.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No models — add API key in Settings</div>
              )}
              {Object.entries(
                availableModels.reduce((acc, m) => {
                  if (!acc[m.provider]) acc[m.provider] = []
                  acc[m.provider].push(m)
                  return acc
                }, {} as Record<string, typeof availableModels>)
              ).map(([prov, models]) => (
                <div key={prov}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/50 sticky top-0">
                    {prov.charAt(0).toUpperCase() + prov.slice(1)}
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setProvider(m.provider)
                        setModel(m.id)
                        setModelDropdownOpen(false)
                      }}
                      className={`w-full px-3 py-2 text-sm flex items-center justify-between hover:bg-accent ${
                        m.id === model && m.provider === provider ? 'bg-primary/10 text-primary' : ''
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {m.capabilities?.map(cap => (
                          <CapabilityIcon key={cap} capability={cap} className="h-3 w-3 text-muted-foreground" />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Style Guide toggle */}
        {projectId && (
          <div className="flex items-center gap-2">
            <input
              id="use-style-guide"
              type="checkbox"
              checked={includeStyleGuide}
              onChange={(e) => setIncludeStyleGuide(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="use-style-guide" className="text-sm flex items-center gap-1 cursor-pointer">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              Use Style Guide
            </label>
          </div>
        )}

        {/* Quick action icons */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Quick Actions</label>
          <div className="flex items-center gap-1">
            {ACTIONS.map((act) => {
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
            })}
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
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What would you like the AI to do? Type /clear to reset chat."
          className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[60px] max-h-[120px] resize-none focus:outline-none focus:ring-1 focus:ring-primary"
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
            title="Skills"
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
              <p className="text-xs text-muted-foreground px-3 py-1">No skills yet</p>
            )}
          </div>
        )}
      </div>
    </div>
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
