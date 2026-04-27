import { useState, useEffect, useCallback } from 'react'

const HIDDEN_KEY = 'fictionforge-hidden-models'
const STARRED_KEY = 'fictionforge-starred-models'

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

function saveSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify(Array.from(set)))
}

export function useModelPreferences() {
  const [hidden, setHidden] = useState<Set<string>>(() => loadSet(HIDDEN_KEY))
  const [starred, setStarred] = useState<Set<string>>(() => loadSet(STARRED_KEY))

  useEffect(() => { saveSet(HIDDEN_KEY, hidden) }, [hidden])
  useEffect(() => { saveSet(STARRED_KEY, starred) }, [starred])

  const toggleHidden = useCallback((modelId: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(modelId)) next.delete(modelId)
      else next.add(modelId)
      return next
    })
  }, [])

  const setHiddenForVendor = useCallback((modelIds: string[], hide: boolean) => {
    setHidden(prev => {
      const next = new Set(prev)
      for (const id of modelIds) {
        if (hide) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const toggleStarred = useCallback((modelId: string) => {
    setStarred(prev => {
      const next = new Set(prev)
      if (next.has(modelId)) next.delete(modelId)
      else next.add(modelId)
      return next
    })
  }, [])

  const isHidden = useCallback((modelId: string) => hidden.has(modelId), [hidden])
  const isStarred = useCallback((modelId: string) => starred.has(modelId), [starred])

  return {
    hidden,
    starred,
    toggleHidden,
    setHiddenForVendor,
    toggleStarred,
    isHidden,
    isStarred,
  }
}
