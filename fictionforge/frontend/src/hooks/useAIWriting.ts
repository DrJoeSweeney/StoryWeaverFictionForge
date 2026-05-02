import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

interface AIModel {
  id: string
  name: string
  provider: string
  real_provider?: string
  cost_tier?: string
  trains_on_data?: boolean
  capabilities: string[]
}

interface AIConfig {
  id: string
  provider: string
}

interface Skill {
  id: string
  name: string
  description: string | null
  category: string
  prompt_template: string
  system_prompt: string | null
  variables: string | null
  example_input: string | null
  example_output: string | null
  action: string | null
  context_sources: string | null
  specific_documents: string | null
  cross_skill_refs: string | null
  is_agentic: boolean
  is_locked: boolean
  is_quick_action: boolean
  icon: string | null
  temperature: number | null
  model: string | null
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  isPlan?: boolean
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

export type InteractionMode =
  | 'normal'
  | 'outline_creation_planning'
  | 'outline_creation_pending'
  | 'outline_to_text_confirm'
  | 'outline_to_text_writing'

const AI_MODEL_KEY = 'fictionforge-ai-model'
const AI_PROVIDER_KEY = 'fictionforge-ai-provider'

function getSavedModel(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(AI_MODEL_KEY) || ''
}

function getSavedProvider(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(AI_PROVIDER_KEY) || ''
}

export function useAIWriting() {
  const [action, setAction] = useState('continue')
  const [customPrompt, setCustomPrompt] = useState('')
  const [model, setModel] = useState(getSavedModel)
  const [provider, setProvider] = useState(getSavedProvider)
  const [loading, setLoading] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [includeStyleGuide, setIncludeStyleGuide] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [pendingPlan, setPendingPlan] = useState<DocumentPlan | null>(null)
  const [creatingIndex, setCreatingIndex] = useState<number>(-1)
  const [reasoningLog, setReasoningLog] = useState<ReasoningLogEntry[]>([])
  const [lastTier, setLastTier] = useState<string>('')
  const [consultedDocs, setConsultedDocs] = useState<ConsultedDoc[]>([])
  const [isAgentic, setIsAgentic] = useState(false)

  const [interactionMode, setInteractionMode] = useState<InteractionMode>('normal')
  const [pendingOutlinePlan, setPendingOutlinePlan] = useState<string | null>(null)
  const [outlineSections, setOutlineSections] = useState<Array<{ title: string; description: string }>>([])
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1)

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

  // Persist model/provider selection across sessions
  useEffect(() => {
    if (model) localStorage.setItem(AI_MODEL_KEY, model)
    else localStorage.removeItem(AI_MODEL_KEY)
  }, [model])

  useEffect(() => {
    if (provider) localStorage.setItem(AI_PROVIDER_KEY, provider)
    else localStorage.removeItem(AI_PROVIDER_KEY)
  }, [provider])

  // When models load, validate saved selection or fall back to first available
  useEffect(() => {
    if (activeModels && activeModels.length > 0) {
      const savedModel = getSavedModel()
      const savedProvider = getSavedProvider()
      const match = activeModels.find(m => m.id === savedModel && m.provider === savedProvider)
      if (match) {
        setModel(match.id)
        setProvider(match.provider)
      } else if (!model) {
        setModel(activeModels[0].id)
        setProvider(activeModels[0].provider)
      }
    }
  }, [activeModels])

  const availableModels = activeModels || []

  const getLanguageInstruction = () => {
    const lang = typeof window !== 'undefined' ? localStorage.getItem('fictionforge-language') || 'en-US' : 'en-US'
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

  const getSkillSystemPrompt = (actionOrSkillId: string, fallback: string): string => {
    // Try lookup by action field first
    const byAction = skills?.find((s) => s.action === actionOrSkillId)
    if (byAction?.system_prompt) {
      return byAction.system_prompt + ' ' + getLanguageInstruction()
    }
    // Try lookup by skill ID
    const byId = skills?.find((s) => s.id === actionOrSkillId)
    if (byId?.system_prompt) {
      return byId.system_prompt + ' ' + getLanguageInstruction()
    }
    return fallback + ' ' + getLanguageInstruction()
  }

  const getSystemPrompt = (act: string) => {
    const fallbacks: Record<string, string> = {
      continue: 'You are a creative writing assistant. Continue the story naturally from where it left off. Match the tone and style of the existing text. Write 2-4 paragraphs.',
      rewrite: 'You are a creative writing assistant. Rewrite the selected text to improve flow, clarity, and impact while preserving the meaning. Maintain the same tone.',
      describe: 'You are a creative writing assistant. Rewrite the selected text with vivid sensory details — sights, sounds, smells, textures, emotions. Make it immersive.',
      shorten: 'You are a creative writing assistant. Make the selected text more concise without losing meaning or impact. Cut unnecessary words.',
      expand: 'You are a creative writing assistant. Expand the selected text with more detail, subtext, and emotional depth. Add 2-3x the length.',
    }
    return getSkillSystemPrompt(act, fallbacks[act] || fallbacks.continue)
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
    if (projectId) {
      body.project_id = projectId
      if (includeStyleGuide) {
        body.include_style_guide = true
      }
    }
    return body
  }

  const clearChat = useCallback(() => {
    setChatMessages([])
    setPendingPlan(null)
    setCreatingIndex(-1)
    setIsAgentic(false)
    setReasoningLog([])
    setLastTier('')
    setConsultedDocs([])
    setInteractionMode('normal')
    setPendingOutlinePlan(null)
    setOutlineSections([])
    setCurrentSectionIndex(-1)
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

  const detectOutlineCreationMode = (text: string): boolean => {
    const t = text.toLowerCase().trim()
    if (t.startsWith('/outline') || t.startsWith('/structure')) return true
    const phrases = [
      'create an outline', 'make an outline', 'generate an outline',
      'outline for', 'outline this', 'structure for', 'structure this',
      'plan the structure', 'create a structure', 'build an outline',
      'outline the', 'structure the', 'outline of', 'structure of',
      'create outline', 'make outline', 'generate outline',
      'create structure', 'make structure', 'generate structure',
      'give me an outline', 'need an outline', 'want an outline',
    ]
    return phrases.some((p) => t.includes(p))
  }

  const detectWriteOutlineMode = (text: string): boolean => {
    const t = text.toLowerCase().trim()
    if (t.startsWith('/writeoutline') || t.startsWith('/fleshout')) return true
    const phrases = [
      'write this outline', 'flesh out this outline', 'expand this outline',
      'write from outline', 'write the outline', 'write this structure',
      'flesh out', 'write out the outline', 'turn outline into text',
      'write based on outline', 'write based on this',
      'write from this outline', 'write from this structure',
      'turn this outline into', 'turn this structure into',
    ]
    return phrases.some((p) => t.includes(p))
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
    setIsAgentic(true)
    try {
      const systemPrompt = getSkillSystemPrompt('plan', `You are a writing assistant helping an author plan new documents.

If the user's request IS about creating new documents, chapters, scenes, notes, or pages, analyze their request and produce a structured plan.

Respond with a JSON object in this exact format (no markdown code blocks, no extra commentary):
{"plan":"Brief description of the plan","documents":[{"title":"Title","description":"What this document will contain","doc_type":"chapter"}]}

Use appropriate doc_type values: chapter, prologue, epilogue, note, scene, part, etc.

If the user's request is NOT about creating documents, just answer their question normally in plain text. Do not force JSON if they are asking a general question.`)

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
      if (projectId) {
        body.project_id = projectId
        if (includeStyleGuide) {
          body.include_style_guide = true
        }
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
          { role: 'assistant', content: `**Plan:** ${plan.plan}\n\n` + plan.documents.map((d, i) => `${i + 1}. **${d.title}** (${d.doc_type})\n   ${d.description}`).join('\n\n') + `\n\nWould you like me to create these documents?`, isPlan: true },
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

  const regeneratePlan = useCallback(async (feedback: string, fullContext: string, projectId?: string) => {
    if (!model || !pendingPlan) return null
    setLoading(true)
    setIsAgentic(true)
    try {
      const previousPlanJson = JSON.stringify({
        plan: pendingPlan.plan,
        documents: pendingPlan.documents,
      })
      const systemPrompt = getSkillSystemPrompt('plan', `You are a writing assistant helping an author revise a document plan.

The user previously requested a document plan. Here is the current plan:
${previousPlanJson}

The user has provided feedback or suggestions. Incorporate their feedback and regenerate the plan.

Respond with a JSON object in this exact format (no markdown code blocks, no extra commentary):
{"plan":"Brief description of the plan","documents":[{"title":"Title","description":"What this document will contain","doc_type":"chapter"}]}

Use appropriate doc_type values: chapter, prologue, epilogue, note, scene, part, etc.`)

      const userPrompt = `Feedback: ${feedback}\n\nCurrent project context:\n${fullContext.slice(0, 2000)}`
      const messages = buildApiMessages(systemPrompt, userPrompt)
      const body: any = {
        messages,
        provider: provider || undefined,
        model: model || undefined,
        temperature: 0.8,
        action: 'plan',
        prompt: feedback,
        ...getReasoningModelPrefs(),
      }
      if (projectId) {
        body.project_id = projectId
        if (includeStyleGuide) {
          body.include_style_guide = true
        }
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
          { role: 'user', content: feedback },
          { role: 'assistant', content: `**Revised Plan:** ${plan.plan}\n\n` + plan.documents.map((d, i) => `${i + 1}. **${d.title}** (${d.doc_type})\n   ${d.description}`).join('\n\n') + `\n\nWould you like me to create these documents?`, isPlan: true },
        ])
        setPendingPlan(plan)
      } else {
        setChatMessages(prev => [
          ...prev,
          { role: 'user', content: feedback },
          { role: 'assistant', content: text },
        ])
      }
      return plan
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: feedback },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
      return null
    } finally {
      setLoading(false)
    }
  }, [model, provider, includeStyleGuide, chatMessages, pendingPlan])

  const generateOutlinePlan = useCallback(async (promptText: string, fullContext: string, projectId?: string) => {
    if (!model) return
    setLoading(true)
    setIsAgentic(true)
    setInteractionMode('outline_creation_planning')
    try {
      const systemPrompt = getSkillSystemPrompt('outline_plan', `You are a creative writing assistant specializing in story structure and outlining.

The user wants to create an outline or structure for their current document. Your task is to analyze their request and the available project context, then present a clear, well-reasoned plan for the outline/structure.

Consider the following when making your plan:
- World-building and setting details (from story bible)
- Character arcs, relationships, and development needs
- Existing story plans or outlines
- Narrative structure appropriate for the genre and content
- Pacing and dramatic tension

Present your plan in a clear format with:
1. An overview of the proposed structure
2. A breakdown of each section/part with title and brief description of what it should contain
3. Rationale for why this structure works for the story

Do NOT write the actual outline yet — just present the plan. Ask the user if they approve or want changes.`)

      const userPrompt = `Request: ${promptText}\n\nCurrent document content:\n${fullContext.slice(0, 3000)}`
      const messages = buildApiMessages(systemPrompt, userPrompt)
      const body: any = {
        messages,
        provider: provider || undefined,
        model: model || undefined,
        temperature: 0.8,
        action: 'outline_plan',
        prompt: promptText,
        ...getReasoningModelPrefs(),
      }
      if (projectId) {
        body.project_id = projectId
        if (includeStyleGuide) {
          body.include_style_guide = true
        }
      }
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      const text = res.data.content
      setReasoningLog(res.data.reasoning_log || [])
      setLastTier(res.data.tier || '')
      setConsultedDocs(res.data.consulted_docs || [])
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: promptText },
        {
          role: 'assistant',
          content:
            text +
            '\n\n---\n\n**Would you like me to generate this outline?**\n- Type **yes** to generate the full outline with suggested word counts\n- Type **(clear)** to clear the chat and start over\n- Or add more context/suggestions to refine the plan',
          isPlan: true,
        },
      ])
      setPendingOutlinePlan(text)
      setPendingPlan(null)
      setInteractionMode('outline_creation_pending')
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: promptText },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
      setInteractionMode('normal')
    } finally {
      setLoading(false)
    }
  }, [model, provider, includeStyleGuide, chatMessages])

  const regenerateOutlinePlan = useCallback(async (feedback: string, fullContext: string, projectId?: string) => {
    if (!model || !pendingOutlinePlan) return
    setLoading(true)
    setIsAgentic(true)
    setInteractionMode('outline_creation_planning')
    try {
      const systemPrompt = getSkillSystemPrompt('outline_plan', `You are a creative writing assistant specializing in story structure.

You previously presented this outline plan:
${pendingOutlinePlan}

The user has provided feedback or additional context. Incorporate their feedback and present a revised plan.

Consider:
- World-building and setting details
- Character arcs and development
- Existing story plans
- Narrative structure and pacing

Present the revised plan clearly and ask if they approve or want further changes.`)

      const userPrompt = `Feedback/additional context: ${feedback}\n\nCurrent document content:\n${fullContext.slice(0, 3000)}`
      const messages = buildApiMessages(systemPrompt, userPrompt)
      const body: any = {
        messages,
        provider: provider || undefined,
        model: model || undefined,
        temperature: 0.8,
        action: 'outline_plan',
        prompt: feedback,
        ...getReasoningModelPrefs(),
      }
      if (projectId) {
        body.project_id = projectId
        if (includeStyleGuide) {
          body.include_style_guide = true
        }
      }
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      const text = res.data.content
      setReasoningLog(res.data.reasoning_log || [])
      setLastTier(res.data.tier || '')
      setConsultedDocs(res.data.consulted_docs || [])
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: feedback },
        {
          role: 'assistant',
          content:
            text +
            '\n\n---\n\n**Would you like me to generate this outline?**\n- Type **yes** to generate the full outline with suggested word counts\n- Type **(clear)** to clear the chat and start over\n- Or add more context/suggestions to refine the plan',
          isPlan: true,
        },
      ])
      setPendingOutlinePlan(text)
      setInteractionMode('outline_creation_pending')
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: feedback },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
      setInteractionMode('normal')
    } finally {
      setLoading(false)
    }
  }, [model, provider, includeStyleGuide, chatMessages, pendingOutlinePlan])

  const generateOutlineContent = useCallback(async (fullContext: string, projectId?: string): Promise<string | null> => {
    if (!model || !pendingOutlinePlan) return null
    setLoading(true)
    setIsAgentic(true)
    try {
      const systemPrompt = getSkillSystemPrompt('outline_generate', `You are a creative writing assistant specializing in story structure.

You have already presented and received approval for the following plan:
${pendingOutlinePlan}

Now, generate the COMPLETE outline/structure based on this plan. For each section, provide:
1. The section title/heading
2. A detailed description of what should be written in that section — sufficient detail for a writer or AI to later flesh it out
3. A suggested word count for the section, based on its importance and complexity

Format the outline clearly using markdown headings and bullet points. Make it detailed and actionable.`)

      const userPrompt = `Generate the full outline based on the approved plan.\n\nCurrent document content:\n${fullContext.slice(0, 2000)}`
      const messages = buildApiMessages(systemPrompt, userPrompt)
      const body: any = {
        messages,
        provider: provider || undefined,
        model: model || undefined,
        temperature: 0.8,
        action: 'outline_generate',
        prompt: 'Generate full outline based on approved plan',
        ...getReasoningModelPrefs(),
      }
      if (projectId) {
        body.project_id = projectId
        if (includeStyleGuide) {
          body.include_style_guide = true
        }
      }
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      const text = res.data.content
      setReasoningLog(res.data.reasoning_log || [])
      setLastTier(res.data.tier || '')
      setConsultedDocs(res.data.consulted_docs || [])
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: 'yes' },
        { role: 'assistant', content: '**Outline generated!**\n\n' + text },
      ])
      setPendingOutlinePlan(null)
      setInteractionMode('normal')
      return text
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: 'yes' },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
      return null
    } finally {
      setLoading(false)
    }
  }, [model, provider, includeStyleGuide, chatMessages, pendingOutlinePlan])

  const parseOutline = useCallback(async (fullContext: string, projectId?: string): Promise<Array<{ title: string; description: string }>> => {
    if (!model) return []
    try {
      const systemPrompt = getSkillSystemPrompt('outline_parse', `You are a writing assistant. Parse the following document into a structured list of sections to write. Return ONLY a JSON array in this exact format:
[{"title":"Section Title","description":"What this section should contain"}]
Do not include any markdown formatting, commentary, or explanation — just the raw JSON.`)
      const userPrompt = `Parse this outline/document into sections:\n\n${fullContext.slice(0, 6000)}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const body: any = {
        messages,
        provider: provider || undefined,
        model: model || undefined,
        temperature: 0.3,
        action: 'outline_parse',
        prompt: 'Parse outline into sections',
        ...getReasoningModelPrefs(),
      }
      if (projectId) {
        body.project_id = projectId
        if (includeStyleGuide) {
          body.include_style_guide = true
        }
      }
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      const text = res.data.content
      let jsonStr = text
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) jsonStr = codeBlockMatch[1]
      const braceMatch = jsonStr.match(/\[[\s\S]*\]/)
      if (braceMatch) jsonStr = braceMatch[0]
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed)) return parsed
      return []
    } catch {
      return []
    }
  }, [model, provider, includeStyleGuide])

  const writeOutlineSection = useCallback(async (
    section: { title: string; description: string },
    fullContext: string,
    previousText: string,
    projectId?: string
  ): Promise<string> => {
    if (!model) throw new Error('No model selected')
    setIsAgentic(true)
    const systemPrompt = getSkillSystemPrompt('outline_section_write', `You are a creative writing assistant.

You are writing a section of a larger document based on an outline. Write the complete prose for this section only.

Rules:
- Write fully fleshed-out prose, not summaries or notes
- Match the tone and style of any existing text
- Use the provided world-building, character, and style information
- Do not include meta-commentary or explanations
- Do not repeat information from previous sections unless necessary for continuity
- Write naturally and engagingly`)

    const userPrompt = `Section to write: ${section.title}
Description: ${section.description}

${previousText ? `Previously written text:\n${previousText.slice(-2000)}\n\n` : ''}Current document context:\n${fullContext.slice(0, 2000)}

Write the full prose for this section only.`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const body: any = {
      messages,
      provider: provider || undefined,
      model: model || undefined,
      temperature: 0.8,
      action: 'outline_section_write',
      prompt: `Write section: ${section.title}`,
      ...getReasoningModelPrefs(),
    }
    if (projectId) {
      body.project_id = projectId
      if (includeStyleGuide) {
        body.include_style_guide = true
      }
    }
    const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
    return res.data.content
  }, [model, provider, includeStyleGuide])

  const writeOutlineToText = useCallback(async (fullContext: string, projectId?: string, onAppend?: (text: string) => void) => {
    if (!model) return
    setLoading(true)
    setIsAgentic(true)
    setInteractionMode('outline_to_text_writing')
    try {
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: 'yes' },
        { role: 'assistant', content: '⏳ Parsing outline and preparing to write...' },
      ])

      const sections = await parseOutline(fullContext, projectId)
      if (!sections.length) {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '❌ Could not parse the outline into sections. Please make sure the current document contains a clear outline or structure.' },
        ])
        setInteractionMode('normal')
        return
      }

      setOutlineSections(sections)
      let accumulatedText = ''

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        setCurrentSectionIndex(i)
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⏳ Writing **${section.title}** (${i + 1}/${sections.length})...` },
        ])

        const text = await writeOutlineSection(section, fullContext, accumulatedText, projectId)
        accumulatedText += '\n\n' + text

        if (onAppend) {
          onAppend(text + '\n\n')
        }

        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `✅ Completed **${section.title}**` },
        ])
      }

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `🎉 Done! Wrote ${sections.length} section(s). The full text has been appended to your document.` },
      ])
      setOutlineSections([])
      setCurrentSectionIndex(-1)
      setInteractionMode('normal')
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ Error: ${err.response?.data?.detail || err.message}` },
      ])
      setInteractionMode('normal')
    } finally {
      setLoading(false)
    }
  }, [model, provider, includeStyleGuide, parseOutline, writeOutlineSection])

  const initiateWriteOutline = useCallback(async () => {
    setPendingPlan(null)
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content:
          '**Outline-to-Text Mode**\n\nIt looks like you want me to write out the outline/structure in the current document. I will systematically work through the entire structure and write the full prose text chunk by chunk, using the style guide, world information, notes, and character details.\n\nThe final text will be appended to the end of the current document.\n\n**Should I proceed?** Type **yes** to start writing, or **cancel** to abort.',
      },
    ])
    setInteractionMode('outline_to_text_confirm')
  }, [])

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
    setIsAgentic(false)
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
  }, [action, model, provider, includeStyleGuide, customPrompt, chatMessages, clearChat, generatePlan, regeneratePlan, pendingPlan])

  const getReasoningModelPrefs = () => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('fictionforge-reasoning-model') : ''
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

    // Handle outline creation pending state
    if (interactionMode === 'outline_creation_pending') {
      if (lowerPrompt === 'yes' || lowerPrompt === '(yes)') {
        const outlineText = await generateOutlineContent(fullContext, projectId)
        setCustomPrompt('')
        return outlineText
      } else if (lowerPrompt === '(clear)' || lowerPrompt === 'clear') {
        clearChat()
        setCustomPrompt('')
        return
      } else {
        await regenerateOutlinePlan(promptText, fullContext, projectId)
        setCustomPrompt('')
        return
      }
    }

    // Handle outline-to-text confirm state
    if (interactionMode === 'outline_to_text_confirm') {
      if (lowerPrompt === 'yes' || lowerPrompt === '(yes)') {
        setCustomPrompt('')
        return 'outline_to_text_confirmed'
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Outline-to-text writing cancelled.' },
        ])
        setInteractionMode('normal')
        setCustomPrompt('')
        return
      }
    }

    // If a plan is pending, treat input as feedback to regenerate the plan
    if (pendingPlan) {
      await regeneratePlan(promptText, fullContext, projectId)
      setCustomPrompt('')
      return
    }

    // Detect outline creation mode
    if (detectOutlineCreationMode(promptText)) {
      await generateOutlinePlan(promptText, fullContext, projectId)
      setCustomPrompt('')
      return
    }

    // Detect outline-to-text mode
    if (detectWriteOutlineMode(promptText)) {
      await initiateWriteOutline()
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
    setIsAgentic(true)
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
      if (projectId) {
        body.project_id = projectId
        if (includeStyleGuide) {
          body.include_style_guide = true
        }
      }
      const res = await api.post<AgenticResponse>('/writing/agentic', body, { timeout: 300000 })
      const { content, reasoning_log, tier, consulted_docs } = res.data
      setReasoningLog(reasoning_log || [])
      setLastTier(tier || '')
      setConsultedDocs(consulted_docs || [])
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: content },
      ])
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: buildUserPrompt(action, selectedText || fullContext.slice(-500), fullContext, promptText) },
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }, [action, model, provider, includeStyleGuide, customPrompt, chatMessages, clearChat, generatePlan, interactionMode, pendingOutlinePlan, pendingPlan, generateOutlinePlan, regenerateOutlinePlan, generateOutlineContent, initiateWriteOutline])

  const generateDocumentContent = useCallback(async (doc: DocumentPlanItem, fullContext: string, projectId?: string): Promise<string> => {
    if (!model) throw new Error('No model selected')
    setIsAgentic(true)
    setReasoningLog([])
    setLastTier('')
    setConsultedDocs([])
    console.log('[AI] Generating content for:', doc.title)
    const systemPrompt = getSkillSystemPrompt('draft', `You are a creative writing assistant.

Write the complete content for the following document.

Title: ${doc.title}
Description: ${doc.description}

Write the full text as it would appear in the final document. Do not include meta-commentary, outlines, or chapter headings unless they are part of the actual content. Just write the prose.`)

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
    if (projectId) {
      body.project_id = projectId
      if (includeStyleGuide) {
        body.include_style_guide = true
      }
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

  const executeSkill = useCallback(async (skillId: string, selectedText: string, fullContext: string, projectId?: string, documentType?: string, fieldName?: string): Promise<string> => {
    if (!model) throw new Error('No model selected')
    setLoading(true)
    setIsAgentic(true)
    setReasoningLog([])
    setLastTier('')
    setConsultedDocs([])
    try {
      const body: any = {
        messages: [
          { role: 'system', content: '' },
          { role: 'user', content: selectedText || fullContext.slice(-500) },
        ],
        context: { text: selectedText, fullContext, documentType, fieldName },
        provider: provider || undefined,
        model: model || undefined,
        project_id: projectId || undefined,
        document_type: documentType || undefined,
        field_name: fieldName || undefined,
        ...getReasoningModelPrefs(),
      }
      const res = await api.post<AgenticResponse>(`/skills/${skillId}/execute`, body, { timeout: 300000 })
      const { content, reasoning_log, tier, consulted_docs } = res.data
      setReasoningLog(reasoning_log || [])
      setLastTier(tier || '')
      setConsultedDocs(consulted_docs || [])
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: `[Skill: ${skillId}] ${selectedText || fullContext.slice(-200)}` },
        { role: 'assistant', content: content },
      ])
      return content
    } catch (err: any) {
      const msg = `Error: ${err.response?.data?.detail || err.message}`
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: `[Skill: ${skillId}] ${selectedText || fullContext.slice(-200)}` },
        { role: 'assistant', content: msg },
      ])
      throw err
    } finally {
      setLoading(false)
    }
  }, [model, provider, includeStyleGuide, chatMessages])

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

  const agenticExecute = useCallback(async (act: string, selectedText: string, fullContext: string, projectId?: string, documentType?: string, fieldName?: string): Promise<string> => {
    if (!model) throw new Error('No model selected')
    setIsAgentic(true)
    setReasoningLog([])
    setLastTier('')
    setConsultedDocs([])
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
      document_type: documentType || undefined,
      field_name: fieldName || undefined,
      ...getReasoningModelPrefs(),
    }
    if (projectId) {
      body.project_id = projectId
      if (includeStyleGuide) {
        body.include_style_guide = true
      }
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
    setIsAgentic(false)
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
    setIsAgentic(true)
    setReasoningLog([])
    setLastTier('')
    setConsultedDocs([])
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
      if (projectId) {
        body.project_id = projectId
        if (includeStyleGuide) {
          body.include_style_guide = true
        }
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
    isAgentic,
    interactionMode,
    generateOutlinePlan,
    regenerateOutlinePlan,
    generateOutlineContent,
    initiateWriteOutline,
    writeOutlineToText,
    currentSectionIndex,
    outlineSections,
    executeSkill,
  }
}
