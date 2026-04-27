import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type FontFamily = 'sans' | 'serif' | 'mono' | 'atkinson'
export type HeadingSize = 'small' | 'medium' | 'large'

export interface UISettings {
  theme: Theme
  fontFamily: FontFamily
  headingSize: HeadingSize
}

const STORAGE_KEY = 'fictionforge-ui-settings'

const defaults: UISettings = {
  theme: 'system',
  fontFamily: 'sans',
  headingSize: 'medium',
}

function loadSettings(): UISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...defaults, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...defaults }
}

function saveSettings(settings: UISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function applyFont(font: FontFamily) {
  const root = document.documentElement
  const fonts: Record<FontFamily, string> = {
    sans: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', Times, serif",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    atkinson: "'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif",
  }
  root.style.setProperty('--app-font', fonts[font])
}

function applyHeadingSize(size: HeadingSize) {
  const root = document.documentElement
  const sizes: Record<HeadingSize, { h1: string; h2: string }> = {
    small: { h1: '1.5rem', h2: '1.25rem' },
    medium: { h1: '1.875rem', h2: '1.5rem' },
    large: { h1: '2.25rem', h2: '1.875rem' },
  }
  root.style.setProperty('--heading-h1-size', sizes[size].h1)
  root.style.setProperty('--heading-h2-size', sizes[size].h2)
}

export function useUISettings() {
  const [settings, setSettingsState] = useState<UISettings>(loadSettings)

  useEffect(() => {
    applyTheme(settings.theme)
    applyFont(settings.fontFamily)
    applyHeadingSize(settings.headingSize)
  }, [settings])

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.theme])

  const setSettings = useCallback((partial: Partial<UISettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, setSettings }
}
