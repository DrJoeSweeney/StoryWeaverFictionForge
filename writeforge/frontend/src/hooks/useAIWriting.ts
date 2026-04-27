import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

interface AIModel {
  id: string
  name: string
  provider: string
  capabilities: string[]
}

interface AIConfig {
  id: string
  provider: string
}

interface Skill {
  id: string
  name: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DocumentPlanItem {
  title: string
  description: string
  doc_type: string
}

export interface DocumentPlan {
  plan: string
  documents: DocumentPlanItem[]
}

export interface ReasoningLogEntry {
  step: string
  detail: string
}

export interface ConsultedDoc {
  type: string
  title: string
  id: string | null
}

export interface AgenticResponse {
  content: string
  reasoning_log: ReasoningLogEntry[]
  tier: string
  consulted_docs: ConsultedDoc[]
}

export function useAIWriting() {
  const [action, setAction] = useState('continue')
  const [customPrompt, setCustomPrompt] = useState('')
  const [model, setModel] = useState('')
  const [provider, setProvider] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [includeStyleGuide, setIncludeStyleGuide] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [pendingPlan, setPendingPlan] = useState<DocumentPlan | null>(null)
  const [creatingIndex, setCreatingIndex] = useState<number>(-1)
  const [reasoningLog, setReasoningLog] = useState<ReasoningLogEntry[]>([])
  const [lastTier, setLastTier] = useState<string>('')
  const [consultedDocs, setConsultedDocs] = useState<ConsultedDoc[]>([])

  const { data: activeModels } = useQuery({
    queryKey: ['ai-active-models'],
    queryFn: async () => {
      const res = await api.get<AIModel[]>('/ai-providers/active-models')
      return res.data
    },
  })

  const { data: configs } = useQuery({
    queryKey: ['ai-configs'],
    queryFn: async () => {
      const res = await api.get<AIConfig[]>('/ai-providers/configs')
      return res.data
    },
  })

  const { data: skills } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await api.get<Skill[]>('/skills')
      return res.data
    },
  })

  useEffect(() => {
    if (activeModels && activeModels.length > 0 && !model) {
      if (activeModels.length > 0) {
        setModel(activeModels[0].id)
        setProvider(activeModels[0].provider)
      }
    }
  }, [activeModels])

  const availableModels = activeModels || []

  const getLanguageInstruction = () => {
    const lang = typeof window !== 'undefined' ? localStorage.getItem('writeforge-language') || 'en-US' : 'en-US'
    const names: Record<string, string> = {
      'en-US': 'US English',
      'en-GB': 'UK English',
      'en-AU': 'Australian English',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ru': 'Russian',
      'pt': 'Portuguese',
      'it': 'Italian',
      'nl': 'Dutch',
      'hi': 'Hindi',
      'ar': 'Arabic',
    }
    return `Respond in ${names[lang] || lang}. Use appropriate spelling and vocabulary for this language.`
  }

  const getSystemPrompt = (act: string) => {
    const prompts: Record<string, string> = {
      continue: 'You are a creative writing assistant. Continue the story naturally from where it left off. Match the tone and style of the existing text. Write 2-4 paragraphs.',
      rewrite: 'You are a creative writing assistant. Rewrite the selected text to improve flow, clarity, and impact while preserving the meaning. Maintain the same tone.',
      describe: 'You are a creative writing assistant. Rewrite the selected text with vivid sensory details — sights, sounds, smells, textures, emotions. Make it immersive.',
      shorten: 'You are a creative writing assistant. Make the selected text more concise without losing meaning or impact. Cut unnecessary words.',
      expand: 'You are a creative writing assistant. Expand the selected text with more detail, subtext, and emotional depth. Add 2-3x the length.',
    }
    return (prompts[act] || prompts.continue) + ' ' + getLanguageInstruction()
  }

  const buildUserPrompt = (act: string, selection: string, context: string, custom: string) => {
    if (custom.trim()) {
      let prompt = custom.trim()
      if (selection) {
        prompt += `\n\nSelected text:\n${selection}`
      }
      if (context) {
        prompt += `\n\nContext:\n${context}`
      }
      return prompt
    }
    if (act === 'continue') {
      return `Context:\n${context}\n\nContinue from here:`
    }
    return `Context:\n${context}\n\nSelected text to ${act}:\n${selection}`
  }

  const buildApiMessages = (systemPrompt: string, userPrompt: string): ChatMessage[] => {
    return [
      { role: 'system', content: systemPrompt },
      ...chatMessages,
      { role: 'user', content: userPrompt },
    ]
  }

  const buildBody = (messages: ChatMessage[], projectId?: string) => {
    const body: any = {
      messages,
      provider: provider || undefined,
      model: model || undefined,
      temperature: 0.8,
    }
    if (projectId && includeStyleGuide) {
      body.project_id = projectId
      body.include_style_guide = true
    }
    return body
  }

  const clearChat = useCallback(() => {
    setChatMessages([])
    setPendingPlan(null)
    setCreatingIndex(-1)
  }, [])

  const detectPlanMode = (text: string): boolean => {
    const t = text.toLowerCase().trim()

    // Explicit commands always trigger plan mode
    if (t.startsWith('/plan') || t.startsWith('/create')) return true

    // Extract words for precise matching (avoids "created" matching "create")
    const words = t.match(/\b[\w']+\b/g) || []

    const createWords = new Set([
      'create', 'make', 'generate', 'write', 'draft', 'produce',
      'build', 'craft', 'compose', 'develop', 'prepare', 'add',
      'start', 'begin', 'come', 'up', 'think', 'design', 'devise',
    ])
    const docWords = new Set([
      'document', 'documents', 'page', 'pages', 'chapter', 'chapters',
      'section', 'sections', 'file', 'files', 'scene', 'scenes',
      'beat', 'beats', 'part', 'parts', 'prologue', 'epilogue',
      'note', 'notes', 'entry', 'entries', 'piece', 'pieces',
      'manuscript', 'story', 'stories', 'outline', 'outlines',
      'draft', 'drafts', 'preface', 'foreword', 'afterword',
      'dedication', 'acknowledgment', 'acknowledgements',
      'appendix', 'volume', 'book', 'act', 'acts',
    ])

    const hasCreate = words.some(w => createWords.has(w))
    const hasDoc = words.some(w => docWords.has(w))

    // Also check for explicit multi-word phrases that strongly indicate creation intent
    const phrases = [
      'as a new', 'into a new', 'save as', 'put in a',
      'new document', 'new chapter', 'new scene', 'new note',
      'new file', 'new page', 'new section', 'new part',
      'write a', 'draft a', 'create a', 'make a', 'generate a',
      'add a', 'start a', 'begin a', 'come up with',
      'write me', 'create me', 'make me', 'generate me',
      'new prologue', 'new epilogue', 'new outline', 'new manuscript',
      'another chapter', 'another scene', 'another document',
      'more chapters', 'more scenes', 'more pages',
      'i need a', 'i want a', 'can you write', 'can you create',
      'can you make', 'can you generate', 'could you write',
    ]
    const hasPhrase = phrases.some(p => t.includes(p))

    return (hasCreate && hasDoc) || hasPhrase
  }

  const parsePlan = (text: string): DocumentPlan | null => {
    try {
      // Try to find JSON in the response (may be wrapped in markdown or plain text)
      let jsonStr = text
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1]
      } else {
        // Try to find { ... } block
        const braceMatch = text.match(/\{[\s\S]*\}/)
        if (braceMatch) {
          jsonStr = braceMatch[0]
        }
      }
      const parsed = JSON.parse(jsonStr)
      if (parsed.documents && Array.isArray(parsed.documents)) {
        return {
          plan: parsed.plan || 'Document creation plan',
          documents: parsed.documents.map((d: any) => ({
            title: d.title || 'Untitled',
            description: d.description || '',
            doc_type: d.doc_type || 'chapter',
          })),
        }
      }
    } catch { /* ignore parse errors */ }
    return null
  }

  const generatePlan = useCallback(async (promptText: string, fullContext: string, projectId?: string): Promise<DocumentPlan | null> => {
    if (!model) return null
    setLoading(true)
    try {
      const systemPrompt = `You are a writing assistant helping an author plan new documents. ${getLanguageInstruction()}

If the user's request IS about creating new documents, chapters, scenes, notes, or pages, analyze their request and produce a structured plan.

Respond with a JSON object in this exact format (no markdown code blocks, no extra commentary):
{"plan":"Brief description of the plan","documents":[{"title":"Title","description":"What this document will contain","doc_type":"chapter"}]}

Use appropriate doc_type values: chapter, prologue, epilogue, note, scene, part, etc.

If the user's request is NOT about creating documents, just answer their question normally in plain text. Do not force JSON if they are asking a general question.`

      // Strip /plan or /create prefix if present
      const cleanPrompt = promptText.replace(/^\/(plan|create)\s*/i, '')
      const userPrompt = `Request: ${cleanPrompt}\n\nCurrent project context:\n${fullContext.slice(0, 2000)}`
      const messages = buildApiMessages(systemPrompt, userPrompt)
      const body: any = {
        messages,
        provider: provider || undefined,
        model: model || undefined,
        temperature: 0.8,
        action: 'plan',
        prompt: promptText,
        ...getReasoningModelPrefs(),
      }
      if (projectId && includeStyleGuide) {
        body.project_id = projectId
        body.include_style_guide = true
      }
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      const text = res.data.content
      setReasoningLog(res.data.reasoning_log || [])
      setLastTier(res.data.tier || '')
      setConsultedDocs(res.data.consulted_docs || [])
      const plan = parsePlan(text)
      if (plan) {
        setChatMessages(prev => [
          ...prev,
          { role: 'user', content: promptText },
          { role: 'assistant', content: `**Plan:** ${plan.plan}\n\n` + plan.documents.map((d, i) => `${i + 1}. **${d.title}** (${d.doc_type})\n   ${d.description}`).join('\n\n') + `\n\nWould you like me to create these documents?` },
        ])
        setPendingPlan(plan)
      } else {
        // Fallback: treat as normal response
        setChatMessages(prev => [
          ...prev,
          { role: 'user', content: promptText },
          { role: 'assistant', content: text },
        ])
      }
      return plan
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: promptText },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
      return null
    } finally {
      setLoading(false)
    }
  }, [model, provider, includeStyleGuide, chatMessages])

  const generate = useCallback(async (selectedText: string, fullContext: string, projectId?: string) => {
    if (!model) return
    const promptText = customPrompt.trim()
    const lowerPrompt = promptText.toLowerCase()
    if (lowerPrompt === '/clear') {
      clearChat()
      setCustomPrompt('')
      return
    }

    // Detect if this looks like a document creation request
    if (detectPlanMode(promptText) || lowerPrompt.startsWith('/plan') || lowerPrompt.startsWith('/create')) {
      await generatePlan(promptText, fullContext, projectId)
      setCustomPrompt('')
      return
    }

    setLoading(true)
    try {
      const systemPrompt = getSystemPrompt(action)
      const userPrompt = buildUserPrompt(action, selectedText || fullContext.slice(-500), fullContext, promptText)
      const messages = buildApiMessages(systemPrompt, userPrompt)
      const body = buildBody(messages, projectId)
      const res = await api.post('/writing/complete', body, { timeout: 300000 })
      const assistantContent = res.data.content
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: assistantContent },
      ])
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: buildUserPrompt(action, selectedText || fullContext.slice(-500), fullContext, promptText) },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }, [action, model, provider, includeStyleGuide, customPrompt, chatMessages, clearChat, generatePlan])

  const getReasoningModelPrefs = () => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('writeforge-reasoning-model') : ''
    if (saved && saved.includes('|')) {
      const [p, m] = saved.split('|')
      return { reasoning_provider: p, reasoning_model: m }
    }
    return {}
  }

  const agenticGenerate = useCallback(async (selectedText: string, fullContext: string, projectId?: string) => {
    if (!model) return
    const promptText = customPrompt.trim()
    const lowerPrompt = promptText.toLowerCase()
    if (lowerPrompt === '/clear') {
      clearChat()
      setCustomPrompt('')
      return
    }

    // Detect if this looks like a document creation request
    if (detectPlanMode(promptText) || lowerPrompt.startsWith('/plan') || lowerPrompt.startsWith('/create')) {
      await generatePlan(promptText, fullContext, projectId)
      setCustomPrompt('')
      return
    }

    setLoading(true)
    setReasoningLog([])
    setLastTier('')
    setConsultedDocs([])
    try {
      const systemPrompt = getSystemPrompt(action)
      const userPrompt = buildUserPrompt(action, selectedText || fullContext.slice(-500), fullContext, promptText)
      const messages = buildApiMessages(systemPrompt, userPrompt)
      const body: any = {
        messages,
        provider: provider || undefined,
        model: model || undefined,
        temperature: 0.8,
        action: action || undefined,
        prompt: promptText || undefined,
        ...getReasoningModelPrefs(),
      }
      if (projectId && includeStyleGuide) {
        body.project_id = projectId
        body.include_style_guide = true
      }
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      const { content, reasoning_log, tier, consulted_docs } = res.data
      setReasoningLog(reasoning_log || [])
      setLastTier(tier || '')
      setConsultedDocs(consulted_docs || [])
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: content },
      ])
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: buildUserPrompt(action, selectedText || fullContext.slice(-500), fullContext, promptText) },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }, [action, model, provider, includeStyleGuide, customPrompt, chatMessages, clearChat, generatePlan])

  const generateDocumentContent = useCallback(async (doc: DocumentPlanItem, fullContext: string, projectId?: string): Promise<string> => {
    if (!model) throw new Error('No model selected')
    console.log('[AI] Generating content for:', doc.title)
    const systemPrompt = `You are a creative writing assistant. ${getLanguageInstruction()}

Write the complete content for the following document.

Title: ${doc.title}
Description: ${doc.description}

Write the full text as it would appear in the final document. Do not include meta-commentary, outlines, or chapter headings unless they are part of the actual content. Just write the prose.`

    const userPrompt = `Write the complete content for "${doc.title}".\n\nProject context:\n${fullContext.slice(0, 2000)}`
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const body: any = {
      messages,
      provider: provider || undefined,
      model: model || undefined,
      temperature: 0.8,
      action: 'draft',
      prompt: `Write content for "${doc.title}"`,
      ...getReasoningModelPrefs(),
    }
    if (projectId && includeStyleGuide) {
      body.project_id = projectId
      body.include_style_guide = true
    }
    try {
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      console.log('[AI] Content generated, length:', res.data.content?.length)
      return res.data.content
    } catch (err: any) {
      console.error('[AI] Content generation failed:', err.message, err.response?.data)
      throw err
    }
  }, [model, provider, includeStyleGuide])

  const execute = useCallback(async (act: string, selectedText: string, fullContext: string, projectId?: string): Promise<string> => {
    if (!model) throw new Error('No model selected')
    const systemPrompt = getSystemPrompt(act)
    const userPrompt = buildUserPrompt(act, selectedText, fullContext, '')
    const messages = buildApiMessages(systemPrompt, userPrompt)
    const body = buildBody(messages, projectId)
    const res = await api.post('/writing/complete', body, { timeout: 300000 })
    const assistantContent = res.data.content
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: `[${act}] ${selectedText || fullContext.slice(-200)}` },
      { role: 'assistant', content: assistantContent },
    ])
    return assistantContent
  }, [model, provider, includeStyleGuide, chatMessages])

  const agenticExecute = useCallback(async (act: string, selectedText: string, fullContext: string, projectId?: string): Promise<string> => {
    if (!model) throw new Error('No model selected')
    const systemPrompt = getSystemPrompt(act)
    const userPrompt = buildUserPrompt(act, selectedText, fullContext, '')
    const messages = buildApiMessages(systemPrompt, userPrompt)
    const body: any = {
      messages,
      provider: provider || undefined,
      model: model || undefined,
      temperature: 0.8,
      action: act,
      prompt: userPrompt,
      ...getReasoningModelPrefs(),
    }
    if (projectId && includeStyleGuide) {
      body.project_id = projectId
      body.include_style_guide = true
    }
    const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
    const { content, reasoning_log, tier, consulted_docs } = res.data
    setReasoningLog(reasoning_log || [])
    setLastTier(tier || '')
    setConsultedDocs(consulted_docs || [])
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: `[${act}] ${selectedText || fullContext.slice(-200)}` },
      { role: 'assistant', content: content },
    ])
    return content
  }, [model, provider, includeStyleGuide, chatMessages])

  const generateToClipboard = useCallback(async (selectedText: string, fullContext: string, projectId?: string): Promise<string> => {
    if (!model) return ''
    setLoading(true)
    try {
      const systemPrompt = getSystemPrompt(action)
      const userPrompt = buildUserPrompt(action, selectedText || fullContext.slice(-500), fullContext, customPrompt)
      const messages = buildApiMessages(systemPrompt, userPrompt)
      const body = buildBody(messages, projectId)
      const res = await api.post('/writing/complete', body, { timeout: 300000 })
      const text = res.data.content
      await navigator.clipboard.writeText(text)
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: text },
      ])
      return text
    } catch (err: any) {
      const msg = `Error: ${err.response?.data?.detail || err.message}`
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: buildUserPrompt(action, selectedText || fullContext.slice(-500), fullContext, customPrompt) },
        { role: 'assistant', content: msg },
      ])
      return ''
    } finally {
      setLoading(false)
    }
  }, [action, model, provider, includeStyleGuide, customPrompt, chatMessages])

  const applySkill = useCallback(async (skillId: string, selectedText: string, fullContext: string, projectId?: string) => {
    if (!model) return
    setLoading(true)
    try {
      const applyRes = await api.post(`/skills/${skillId}/apply`, {
        context: { text: selectedText || fullContext, selected_text: selectedText },
      })
      const rendered = applyRes.data.rendered_prompt
      const systemPrompt = 'You are a creative writing assistant. ' + getLanguageInstruction()
      const messages = buildApiMessages(systemPrompt, rendered)
      const body: any = {
        messages,
        provider: provider || undefined,
        model: model || undefined,
        temperature: 0.8,
        action: 'skill',
        prompt: `[Skill: ${skillId}]`,
        ...getReasoningModelPrefs(),
      }
      if (projectId && includeStyleGuide) {
        body.project_id = projectId
        body.include_style_guide = true
      }
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      const { content, reasoning_log, tier, consulted_docs } = res.data
      setReasoningLog(reasoning_log || [])
      setLastTier(tier || '')
      setConsultedDocs(consulted_docs || [])
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: `[Skill: ${skillId}]` },
        { role: 'assistant', content: content },
      ])
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: `[Skill: ${skillId}]` },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }, [model, provider, includeStyleGuide, chatMessages])

  return {
    action,
    setAction,
    customPrompt,
    setCustomPrompt,
    model,
    setModel,
    provider,
    setProvider,
    loading,
    setLoading,
    showSkills,
    setShowSkills,
    includeStyleGuide,
    setIncludeStyleGuide,
    chatMessages,
    setChatMessages,
    clearChat,
    pendingPlan,
    setPendingPlan,
    creatingIndex,
    setCreatingIndex,
    generateDocumentContent,
    activeModels,
    configs,
    skills,
    availableModels,
    generate,
    generateToClipboard,
    applySkill,
    execute,
    agenticGenerate,
    agenticExecute,
    reasoningLog,
    lastTier,
    consultedDocs,
  }
}
