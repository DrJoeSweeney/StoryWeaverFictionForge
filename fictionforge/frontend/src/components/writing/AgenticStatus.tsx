import { useState } from 'react'
import {
  ChevronUp, ChevronDown, BookOpen,
  Brain, Feather, ScrollText, FileText, Globe
} from 'lucide-react'

export interface ConsultedDoc {
  type: string
  title: string
  id: string | null
}

interface AgenticStatusProps {
  consultedDocs: ConsultedDoc[]
}

function getDocIcon(type: string) {
  const t = type.toLowerCase()
  if (t.includes('style')) return <ScrollText className="h-3.5 w-3.5 text-amber-600" />
  if (t.includes('character')) return <Brain className="h-3.5 w-3.5 text-purple-600" />
  if (t.includes('outline')) return <Feather className="h-3.5 w-3.5 text-blue-600" />
  if (t.includes('bible') || t.includes('world')) return <BookOpen className="h-3.5 w-3.5 text-green-600" />
  if (t.includes('search') || t.includes('web')) return <Globe className="h-3.5 w-3.5 text-cyan-600" />
  if (t.includes('document') || t.includes('chapter')) return <FileText className="h-3.5 w-3.5 text-slate-600" />
  return <Feather className="h-3.5 w-3.5 text-muted-foreground" />
}

export default function AgenticStatus({ consultedDocs }: AgenticStatusProps) {
  const [expanded, setExpanded] = useState(false)

  if (consultedDocs.length === 0) return null

  return (
    <div className="shrink-0 border-t bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-accent/50 transition-colors"
      >
        <span className="flex-1 text-left text-muted-foreground">
          Consulted {consultedDocs.length} document{consultedDocs.length > 1 ? 's' : ''}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t bg-secondary/20">
          <div className="pt-2 space-y-1">
            {consultedDocs.map((doc, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-background/60"
              >
                <span className="shrink-0">{getDocIcon(doc.type)}</span>
                <span className="text-foreground/90">{doc.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">
                  {doc.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
