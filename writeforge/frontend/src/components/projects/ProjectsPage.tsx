import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/api/client'
import { Plus, BookOpen, Trash2 } from 'lucide-react'

interface Project {
  id: string
  title: string
  description: string | null
  genre: string | null
  tone: string | null
  status: string
  updated_at: string
}

export default function ProjectsPage() {
  const [showForm, setShowForm] = useState(false)
  const [newProject, setNewProject] = useState({ title: '', description: '', genre: '', tone: '' })
  const queryClient = useQueryClient()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get<Project[]>('/projects')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof newProject) => api.post('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowForm(false)
      setNewProject({ title: '', description: '', genre: '', tone: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProject.title.trim()) return
    createMutation.mutate(newProject)
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading projects...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Projects</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-6 bg-card rounded-lg border space-y-4">
          <h2 className="text-lg font-semibold">Create New Project</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <input
                value={newProject.title}
                onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Genre</label>
              <input
                value={newProject.genre}
                onChange={(e) => setNewProject({ ...newProject, genre: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder="Fantasy, Sci-Fi, Romance..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tone</label>
            <input
              value={newProject.tone}
              onChange={(e) => setNewProject({ ...newProject, tone: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="Dark, Whimsical, Gritty..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-md hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <div
            key={project.id}
            className="p-6 bg-card rounded-lg border hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between">
              <Link to={`/projects/${project.id}`} className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{project.title}</h3>
                </div>
                {project.genre && (
                  <span className="inline-block px-2 py-1 text-xs bg-secondary rounded-md mb-2">
                    {project.genre}
                  </span>
                )}
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                )}
                {project.tone && (
                  <p className="text-xs text-muted-foreground mt-2">Tone: {project.tone}</p>
                )}
              </Link>
              <button
                onClick={() => deleteMutation.mutate(project.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {projects?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No projects yet</p>
          <p className="text-sm">Create your first writing project to get started</p>
        </div>
      )}
    </div>
  )
}
