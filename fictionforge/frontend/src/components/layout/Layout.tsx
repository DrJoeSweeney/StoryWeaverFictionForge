import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { BookOpen, LogOut, User, Wand2, Settings, Home, Search } from 'lucide-react'
import GlobalSearchModal from '@/components/search/GlobalSearchModal'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)

  // Extract project ID from URL if on a project page
  const projectMatch = location.pathname.match(/\/projects\/([^/]+)/)
  const projectId = projectMatch ? projectMatch[1] : null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  // Keyboard shortcut: Cmd/Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (projectId) {
          setSearchOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [projectId])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <BookOpen className="h-6 w-6" />
            FictionForge
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive('/') && !isActive('/projects') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Home className="h-4 w-4" />
              Projects
            </Link>
            <Link
              to="/skills"
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive('/skills') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wand2 className="h-4 w-4" />
              Agents
            </Link>
            <Link
              to="/settings"
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive('/settings') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="h-4 w-4" />
              Configuration
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            {projectId && (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                title="Search project (Cmd+K)"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden md:inline-flex px-1.5 py-0.5 rounded bg-secondary border text-[10px] font-mono">⌘K</kbd>
              </button>
            )}
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="h-4 w-4" />
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="px-4 py-6">
        <Outlet />
      </main>

      {searchOpen && projectId && (
        <GlobalSearchModal
          projectId={projectId}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}
