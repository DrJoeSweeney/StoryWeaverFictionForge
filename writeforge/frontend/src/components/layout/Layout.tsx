import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { BookOpen, LogOut, User, Wand2, Settings, Home } from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <BookOpen className="h-6 w-6" />
            WriteForge
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
              Skills
            </Link>
            <Link
              to="/settings"
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive('/settings') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </nav>
          <div className="flex items-center gap-4">
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
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
