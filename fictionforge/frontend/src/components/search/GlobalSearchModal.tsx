import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Loader, BookOpen, Users, BookMarked, FileText, Palette, Route } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import api from '@/api/client'

interface SearchResult {
  id: string
  module: string
  classification: string
  score: number
  metadata: {
    title?: string
    name?: string
    type?: string
    parent_id?: string
  }
}

interface GlobalSearchModalProps {
  projectId: string
  onClose: () => void
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  Writing: <BookOpen className="h-4 w-4" />,
  Notes: <FileText className="h-4 w-4" />,
  Characters: <Users className="h-4 w-4" />,
  StoryBible: <BookMarked className="h-4 w-4" />,
  StyleGuide: <Palette className="h-4 w-4" />,
  StoryPlan: <Route className="h-4 w-4" />,
}

const MODULE_LABELS: Record<string, string> = {
  Writing: 'Writing',
  Notes: 'Notes',
  Characters: 'Characters',
  StoryBible: 'Story Bible',
  StyleGuide: 'Style',
  StoryPlan: 'Story Plan',
}

export default function GlobalSearchModal({ projectId, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await api.post<{ results: SearchResult[] }>(`/embeddings/project/${projectId}/search`, {
        query: q,
        top_k: 15,
      })
      return res.data.results
    },
    onSuccess: (data) => {
      setResults(data)
      setSelectedIndex(0)
    },
  })

  const debouncedSearch = useCallback(
    (q: string) => {
      if (q.trim().length < 2) {
        setResults([])
        return
      }
      searchMutation.mutate(q)
    },
    [searchMutation]
  )

  useEffect(() => {
    const timer = setTimeout(() => debouncedSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, debouncedSearch])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = results[selectedIndex]
        if (selected) {
          navigateToResult(selected)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [results, selectedIndex, onClose])

  const navigateToResult = (result: SearchResult) => {
    const mod = result.module
    const id = result.metadata.parent_id || result.id

    if (mod === 'Writing' || mod === 'Notes') {
      navigate(`/projects/${projectId}?tab=writing&doc=${id}`)
    } else if (mod === 'Characters') {
      navigate(`/projects/${projectId}?tab=characters&char=${id}`)
    } else if (mod === 'StoryBible') {
      navigate(`/projects/${projectId}?tab=world&entry=${id}`)
    } else if (mod === 'StyleGuide') {
      navigate(`/projects/${projectId}?tab=style-guide&entry=${id}`)
    } else if (mod === 'StoryPlan') {
      navigate(`/projects/${projectId}?tab=story-engine&outline=${id}`)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-card border rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your project... (e.g., dragons, character motivation, chapter 3)"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground/60"
          />
          {searchMutation.isPending && <Loader className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 && query.trim().length >= 2 && !searchMutation.isPending && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found. Try a different query.
            </div>
          )}
          {results.length === 0 && query.trim().length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search...
            </div>
          )}
          {results.map((r, idx) => {
            const label = MODULE_LABELS[r.module] || r.module
            const icon = MODULE_ICONS[r.module] || <Search className="h-4 w-4" />
            const title = r.metadata.title || r.metadata.name || r.id
            const isSelected = idx === selectedIndex

            return (
              <button
                key={`${r.id}-${idx}`}
                onClick={() => navigateToResult(r)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded bg-secondary text-muted-foreground shrink-0">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                      {label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.classification} · relevance {(r.score * 100).toFixed(0)}%
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-secondary/30 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-secondary border text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-secondary border text-[10px]">↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-secondary border text-[10px]">↵</kbd> open</span>
          </div>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
