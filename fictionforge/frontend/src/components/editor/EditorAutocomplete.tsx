import { useState, useEffect, useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/core'

interface SuggestionItem {
  id: string
  label: string
}

interface EditorAutocompleteProps {
  editor: Editor | null
  documents: { id: string; title: string; content?: string }[]
  tags: string[]
}

function extractHeadings(content: string): string[] {
  const headings: string[] = []
  const regex = /^#{1,6}\s+(.+)$/gm
  let match
  while ((match = regex.exec(content)) !== null) {
    headings.push(match[1].trim())
  }
  return headings
}

export default function EditorAutocomplete({ editor, documents, tags }: EditorAutocompleteProps) {
  const [visible, setVisible] = useState(false)
  const [items, setItems] = useState<SuggestionItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [mode, setMode] = useState<'link' | 'heading' | 'tag' | null>(null)
  const [headingDoc, setHeadingDoc] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const checkTrigger = useCallback(() => {
    if (!editor || editor.isDestroyed || !editor.isFocused) {
      setVisible(false)
      return
    }

    const { from, empty } = editor.state.selection
    if (!empty) {
      setVisible(false)
      return
    }

    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 80), from)

    // Check for [[DocName#Heading trigger (heading link)
    const headingMatch = textBefore.match(/\[\[([^\]|#]+)#([^\]]*)$/)
    if (headingMatch) {
      const docTitle = headingMatch[1].trim()
      const q = headingMatch[2].toLowerCase()
      const doc = documents.find((d) => d.title.trim().toLowerCase() === docTitle.toLowerCase())
      if (doc?.content) {
        const headings = extractHeadings(doc.content)
          .filter((h) => h.toLowerCase().includes(q))
          .map((h) => ({ id: h, label: h }))
        if (headings.length > 0 || q.length === 0) {
          setItems(headings.length > 0 ? headings : extractHeadings(doc.content).map((h) => ({ id: h, label: h })))
          setMode('heading')
          setHeadingDoc(doc.title)
          setSelectedIndex(0)
          setVisible(true)
          const coords = editor.view.coordsAtPos(from)
          setPosition({ top: coords.bottom + 4, left: coords.left })
          return
        }
      }
    }

    // Check for [[ trigger (link)
    const linkMatch = textBefore.match(/\[\[([^\]]*)$/)
    if (linkMatch) {
      const q = linkMatch[1].toLowerCase()
      const filtered = documents
        .filter((d) => d.title.toLowerCase().includes(q))
        .map((d) => ({ id: d.id, label: d.title }))
      if (filtered.length > 0) {
        setItems(filtered)
        setMode('link')
        setHeadingDoc(null)
        setSelectedIndex(0)
        setVisible(true)
        const coords = editor.view.coordsAtPos(from)
        setPosition({ top: coords.bottom + 4, left: coords.left })
        return
      }
    }

    // Check for # trigger (tag)
    const tagMatch = textBefore.match(/(?:^|\s)#([a-zA-Z0-9_-]*)$/)
    if (tagMatch) {
      const q = tagMatch[1].toLowerCase()
      const filtered = tags
        .filter((t) => t.toLowerCase().includes(q))
        .map((t) => ({ id: t, label: t }))
      if (filtered.length > 0 || q.length === 0) {
        setItems(filtered.length > 0 ? filtered : tags.map((t) => ({ id: t, label: t })))
        setMode('tag')
        setHeadingDoc(null)
        setSelectedIndex(0)
        setVisible(true)
        const coords = editor.view.coordsAtPos(from)
        setPosition({ top: coords.bottom + 4, left: coords.left })
        return
      }
    }

    setVisible(false)
  }, [editor, documents, tags])

  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      // Defer to next tick so selection state is settled
      requestAnimationFrame(checkTrigger)
    }
    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
    }
  }, [editor, checkTrigger])

  const insertLink = useCallback(
    (title: string, heading?: string) => {
      if (!editor || editor.isDestroyed) return
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 80), from)
      const match = textBefore.match(/\[\[[^\]]*$/)
      if (!match) return
      const start = from - match[0].length
      const linkText = heading ? `[[${title}#${heading}]]` : `[[${title}]]`
      editor
        .chain()
        .focus()
        .deleteRange({ from: start, to: from })
        .insertContentAt(start, {
          type: 'text',
          text: linkText,
          marks: [
            {
              type: 'internalLink',
              attrs: { title, heading: heading || null },
            },
          ],
        })
        .run()
      setVisible(false)
    },
    [editor]
  )

  const insertTag = useCallback(
    (tag: string) => {
      if (!editor || editor.isDestroyed) return
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 50), from)
      const match = textBefore.match(/(?:^|\s)#[a-zA-Z0-9_-]*$/)
      if (!match) return
      const start = from - match[0].length + 1 // +1 to keep the space if present
      editor
        .chain()
        .focus()
        .deleteRange({ from: start, to: from })
        .insertContentAt(start, {
          type: 'text',
          text: `#${tag}`,
          marks: [
            {
              type: 'contentTag',
              attrs: { tag },
            },
          ],
        })
        .run()
      setVisible(false)
    },
    [editor]
  )

  const handleSelect = useCallback(
    (item: SuggestionItem) => {
      if (mode === 'link') insertLink(item.label)
      else if (mode === 'heading') insertLink(headingDoc || item.label, item.label)
      else if (mode === 'tag') insertTag(item.label)
    },
    [mode, headingDoc, insertLink, insertTag]
  )

  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % items.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + items.length) % items.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (items[selectedIndex]) handleSelect(items[selectedIndex])
      } else if (e.key === 'Escape') {
        setVisible(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, items, selectedIndex, handleSelect])

  // Close when clicking outside
  useEffect(() => {
    if (!visible) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [visible])

  if (!visible || items.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[180px] max-h-[240px] overflow-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
        {mode === 'link' ? 'Link to document' : mode === 'heading' ? `Headings in ${headingDoc}` : 'Tag'}
      </div>
      {items.map((item, index) => (
        <button
          key={item.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleSelect(item)}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          }`}
        >
          {mode === 'link' && (
            <span className="inline-block w-4 h-4 mr-1.5 align-text-bottom">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </span>
          )}
          {mode === 'tag' && <span className="mr-1.5 text-muted-foreground">#</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}
