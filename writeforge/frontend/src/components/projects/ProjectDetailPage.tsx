import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'
import { FileText, BookMarked, Users, Network, Loader2, Route, Download, BookOpen, Palette } from 'lucide-react'
import DocumentEditor from '@/components/editor/DocumentEditor'
import StoryBiblePage from '@/components/story-bible/StoryBiblePage'
import CharactersPage from '@/components/character/CharactersPage'
import CanvasPage from '@/components/canvas/CanvasPage'
import StoryEnginePage from '@/components/story-engine/StoryEnginePage'
import BookEditor from '@/components/editor/BookEditor'
import StyleGuidePage from '@/components/style-guide/StyleGuidePage'

interface Project {
  id: string
  title: string
  description: string | null
  genre: string | null
}

const TABS = [
  { id: 'book', label: 'Book', icon: BookOpen },
  { id: 'story-bible', label: 'Story Bible', icon: BookMarked },
  { id: 'characters', label: 'Characters', icon: Users },
  { id: 'story-engine', label: 'Story Plan', icon: Route },
  { id: 'documents', label: 'Notes', icon: FileText },
  { id: 'canvas', label: 'Graph', icon: Network },
  { id: 'style-guide', label: 'Style', icon: Palette },
]

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState('book')

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get<Project>(`/projects/${projectId}`)
      return res.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!projectId) return <div>Project not found</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project?.title}</h1>
          {project?.genre && (
            <p className="text-sm text-muted-foreground">{project.genre}</p>
          )}
        </div>
        <button
          onClick={async () => {
            const res = await api.post(`/export/obsidian/${projectId}`, {}, { responseType: 'blob' })
            const blob = new Blob([res.data], { type: 'application/zip' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const filename = res.headers['content-disposition']?.split('filename=')[1] || `${project?.title || 'project'}_obsidian_vault.zip`
            a.download = filename.replace(/"/g, '')
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent"
        >
          <Download className="h-4 w-4" />
          Export to Obsidian
        </button>
      </div>

      <div className="border-b">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-2">
        {activeTab === 'book' && <BookEditor projectId={projectId} />}
        {activeTab === 'documents' && <DocumentEditor projectId={projectId} />}
        {activeTab === 'style-guide' && <StyleGuidePage projectId={projectId} />}
        {activeTab === 'story-bible' && <StoryBiblePage projectId={projectId} />}
        {activeTab === 'characters' && <CharactersPage projectId={projectId} />}
        {activeTab === 'story-engine' && <StoryEnginePage projectId={projectId} />}
        {activeTab === 'canvas' && <CanvasPage projectId={projectId} />}
      </div>
    </div>
  )
}
