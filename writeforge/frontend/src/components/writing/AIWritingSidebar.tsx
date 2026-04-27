import { useRef, useState, useEffect } from 'react'
import { useAIWriting } from '@/hooks/useAIWriting'
import api from '@/api/client'
import {
  Wand2, Sparkles, RefreshCw, Type, ArrowRight,
  ChevronLeft, Loader2, Check, Zap, BookOpen,
  MessageSquare, Trash2, FilePlus, X
} from 'lucide-react'

interface AIWritingSidebarProps {
  getSelectedText: () => string
  getFullContext: () => string
  onInsert: (text: string) => void
  projectId?: string
  onCollapseChange?: (collapsed: boolean) => void
}

const ACTIONS = [
  { id: 'continue', label: 'Continue', icon: ArrowRight, description: 'Continue from here' },
  { id: 'rewrite', label: 'Rewrite', icon: RefreshCw, description: 'Rephrase selection' },
  { id: 'describe', label: 'Describe', icon: Type, description: 'Add vivid detail' },
  { id: 'shorten', label: 'Shorten', icon: Zap, description: 'Make it concise' },
  { id: 'expand', label: 'Expand', icon: Sparkles, description: 'Add depth' },
]

export default function AIWritingSidebar({ getSelectedText, getFullContext, onInsert, projectId, onCollapseChange }: AIWritingSidebarProps) {
  const [isCollapsed, setIsCollapsedInternal] = useState(false)
  const setIsCollapsed = (v: boolean) => {
    setIsCollapsedInternal(v)
    onCollapseChange?.(v)
  }
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null)
  const [quickActionError, setQuickActionError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
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
    generate,
    applySkill,
    execute,
  } = useAIWriting()

  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, loading, pendingPlan, creatingIndex])

  const handleGenerate = () => generate(getSelectedText(), getFullContext(), projectId)
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
      const text = await execute(actionId, selectedText, fullContext, projectId)
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
    setPendingPlan(null)

    const docs = pendingPlan.documents
    const fullContext = getFullContext()
    let successCount = 0

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      setCreatingIndex(i)
      setChatMessages(prev => [...prev, { role: 'assistant', content: `⏳ Creating **${doc.title}**...` }])

      try {
        console.log('[DocCreate] Generating content for:', doc.title)
        setLoading(true)
        const content = await generateDocumentContent(doc, fullContext, projectId)
        setLoading(false)
        console.log('[DocCreate] Content generated, saving document:', doc.title, 'length:', content?.length)

        const saveRes = await api.post('/documents', {
          project_id: projectId,
          title: doc.title,
          content: content,
          parent_id: null,
          doc_type: doc.doc_type || 'chapter',
        })
        console.log('[DocCreate] Document saved:', saveRes.data?.id)
        successCount++
        setChatMessages(prev => [...prev, { role: 'assistant', content: `✅ Created **${doc.title}**` }])
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
    setChatMessages(prev => [...prev, { role: 'assistant', content: `Done! Created ${successCount}/${docs.length} document(s).` }])
    console.log('[DocCreate] Finished. Success:', successCount, '/', docs.length)
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
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Model</label>
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
          </div>
          <select
            value={`${provider}|${model}`}
            onChange={(e) => {
              const [p, m] = e.target.value.split('|')
              setProvider(p)
              setModel(m)
            }}
            className="w-full px-2 py-1.5 border rounded-md bg-background text-sm"
          >
            {Object.entries(
              availableModels.reduce((acc, m) => {
                if (!acc[m.provider]) acc[m.provider] = []
                acc[m.provider].push(m)
                return acc
              }, {} as Record<string, typeof availableModels>)
            ).map(([prov, models]) => (
              <optgroup key={prov} label={prov.charAt(0).toUpperCase() + prov.slice(1)}>
                {models.map((m) => (
                  <option key={m.id} value={`${m.provider}|${m.id}`}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
            {availableModels.length === 0 && (
              <option value="">No models — add API key in Settings</option>
            )}
          </select>
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
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onInsert(msg.content)}
                      className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                    >
                      <Check className="h-3 w-3" />
                      Insert
                    </button>
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
            </div>
          </div>
        )}

        {/* Plan confirmation */}
        {pendingPlan && (
          <div className="flex justify-start">
            <div className="max-w-[95%] w-full bg-background border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FilePlus className="h-4 w-4 text-primary" />
                Document Plan
              </div>
              <p className="text-xs text-muted-foreground">{pendingPlan.plan}</p>
              <div className="space-y-1">
                {pendingPlan.documents.map((doc, i) => (
                  <div key={i} className="text-xs px-2 py-1 bg-secondary/50 rounded">
                    <span className="font-medium">{doc.title}</span>
                    <span className="text-muted-foreground ml-1">({doc.doc_type})</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCreateDocuments}
                  disabled={isCreating}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <FilePlus className="h-3 w-3" />}
                  Create {pendingPlan.documents.length} document{pendingPlan.documents.length > 1 ? 's' : ''}
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCancelPlan}
                  disabled={isCreating}
                  className="px-3 py-1.5 border rounded text-xs hover:bg-accent disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

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

// Simple markdown renderer for plan text
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```[\s\S]*?```/g, (m) => `<pre class="bg-secondary p-2 rounded text-xs overflow-auto">${m.slice(3, -3)}</pre>`)
    .replace(/`(.*?)`/g, '<code class="bg-secondary px-1 rounded text-xs">$1</code>')
    .replace(/\n/g, '<br/>')
}
