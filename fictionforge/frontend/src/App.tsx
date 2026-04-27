import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/auth'
import { useUISettings } from './hooks/useUISettings'
import api from './api/client'
import Layout from './components/layout/Layout'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import ProjectsPage from './components/projects/ProjectsPage'
import ProjectDetailPage from './components/projects/ProjectDetailPage'
import SkillsPage from './components/skills/SkillsPage'
import SettingsPage from './components/settings/SettingsPage'

function App() {
  const { isAuthenticated, setUser, logout } = useAuthStore()
  useUISettings() // applies theme/font/heading CSS vars on mount

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => logout())
    }
  }, [isAuthenticated, setUser, logout])

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <RegisterPage />} />
      <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
