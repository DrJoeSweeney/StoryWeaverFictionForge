import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { useEffect, useState, useMemo, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { persistentSelectionKey, PersistentSelection } from './PersistentSelection'
import { InternalLink } from './extensions/InternalLink'
import { ExternalLink } from './extensions/ExternalLink'
import { ContentTag } from './extensions/Tag'
import { FoldHeading } from './extensions/FoldHeading'
import { FileEmbed } from './extensions/FileEmbed'
import SpeechMicButton from '@/components/SpeechMicButton'
import HoverPreviewPopover, { useHoverPreview } from './HoverPreview'
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Quote, Code, Undo, Redo, Eye, FileCode, Tag, BookOpen,
  ImageIcon, TableIcon, Link, Minus, CornerDownLeft, FileText
} from 'lucide-react'

/**
 * Post-process HTML produced by marked to convert wiki-link and tag syntax
 * into HTML that TipTap can parse via our custom extensions.
 *
 * Supports Obsidian-style links:
 *   [[Document Name]]
 *   [[Document Name|Display Text]]
 *   [[Document Name#Heading]]
 *   [[Document Name#Heading|Display Text]]
 */
function postprocessWikiLinksAndTags(html: string, validTitles?: Set<string>): string {
  // [text](url) → <a href="url">text</a> (external links)
  let result = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, text, url) => `<a href="${url}">${text}</a>`
  )
  // ![[Title#Heading|Display]] → <div data-type="file-embed" data-title="Title" ...></div>
  result = result.replace(
    /!\[\[([^|\]#]+)(?:#([^|\]]+))?(?:\|([^\]]+))?\]\]/g,
    (_match, title, heading, display) => {
      const safeTitle = title.trim()
      const safeHeading = heading ? heading.trim() : ''
      const safeDisplay = display ? display.trim() : ''
      let attrs = `data-type="file-embed" data-title="${safeTitle}"`
      if (safeHeading) attrs += ` data-heading="${safeHeading}"`
      if (safeDisplay) attrs += ` data-display="${safeDisplay}"`
      return `<div ${attrs}></div>`
    }
  )
  // [[Title#Heading^blockId|Display]] → <a class="internal-link" ...>Display</a>
  result = result.replace(
    /\[\[([^|\]#^]+)(?:#([^|\]^]+))?(?:\^([^|\]]+))?(?:\|([^\]]+))?\]\]/g,
    (_match, title, heading, blockId, display) => {
      const safeTitle = title.trim()
      const safeHeading = heading ? heading.trim() : ''
      const safeBlockId = blockId ? blockId.trim() : ''
      const safeDisplay = display ? display.trim() : ''
      const text = safeDisplay || (safeHeading ? `[[${safeTitle}#${safeHeading}]]` : `[[${safeTitle}]]`)
      const isBroken = validTitles && !validTitles.has(safeTitle)
      let attrs = `class="internal-link" data-title="${safeTitle}"`
      if (safeHeading) attrs += ` data-heading="${safeHeading}"`
      if (safeBlockId) attrs += ` data-block-id="${safeBlockId}"`
      if (safeDisplay) attrs += ` data-display="${safeDisplay}"`
      if (isBroken) attrs += ' data-broken="true"'
      return `<a ${attrs}>${text}</a>`
    }
  )
  // ![alt](url) → <img src="url" alt="alt" />
  result = result.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, alt, url) => `<img src="${url}" alt="${alt}" />`
  )
  // #tag → <span class="content-tag">#tag</span>
  return result.replace(
    /(^|\s|>)#([a-zA-Z0-9_/-]+)(?![a-zA-Z0-9_/-])/g,
    '$1<span class="content-tag" data-tag="$2">#$2</span>'
  )
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

// Preserve external links as [text](url) in markdown output
turndown.addRule('externalLink', {
  filter: (node) => {
    const el = node as HTMLElement
    return (
      el.nodeName === 'A' &&
      !el.classList.contains('internal-link') &&
      !el.classList.contains('content-tag') &&
      !!el.getAttribute('href')
    )
  },
  replacement: (content, node) => {
    const url = node.getAttribute('href') || ''
    return `[${content}](${url})`
  },
})

// Preserve internal links as [[Title#Heading^blockId|Display]] in markdown output
turndown.addRule('internalLink', {
  filter: (node) =>
    node.nodeName === 'A' && node.classList.contains('internal-link'),
  replacement: (_content, node) => {
    const title = node.getAttribute('data-title') || ''
    const heading = node.getAttribute('data-heading')
    const blockId = node.getAttribute('data-block-id')
    const display = node.getAttribute('data-display')
    if (!title) return _content
    let result = `[[${title}`
    if (heading) result += `#${heading}`
    if (blockId) result += `^${blockId}`
    // If user edited the link text, preserve it as display text
    const expected = display || (heading ? `[[${title}#${heading}]]` : `[[${title}]]`)
    if (_content && _content !== expected) {
      result += `|${_content}`
    } else if (display) {
      result += `|${display}`
    }
    result += ']]'
    return result
  },
})

// Preserve file embeds as ![[Title#Heading|Display]] in markdown output
turndown.addRule('fileEmbed', {
  filter: (node) => node.getAttribute('data-type') === 'file-embed',
  replacement: (_content, node) => {
    const title = node.getAttribute('data-title') || ''
    const heading = node.getAttribute('data-heading')
    const display = node.getAttribute('data-display')
    let result = `![[${title}`
    if (heading) result += `#${heading}`
    if (display) result += `|${display}`
    result += ']]'
    return result
  },
})

// Preserve images as ![alt](url) in markdown output
turndown.addRule('image', {
  filter: 'img',
  replacement: (_content, node) => {
    const el = node as HTMLElement
    const src = el.getAttribute('src') || ''
    const alt = el.getAttribute('alt') || ''
    return `![${alt}](${src})`
  },
})

// Preserve content tags as #tag in markdown output
turndown.addRule('contentTag', {
  filter: (node) =>
    node.nodeName === 'SPAN' && node.classList.contains('content-tag'),
  replacement: (content) => content,
})

export interface TipTapEditorRef {
  getSelectionInfo: () => { text: string; from: number; to: number; empty: boolean } | null
  replaceSelection: (text: string) => void
  insertAtCursor: (text: string) => void
  appendToEnd: (text: string) => void
  focus: () => void
  isFocused: () => boolean
  getContent: () => string
}

interface DocumentRef {
  id: string
  title: string
  content?: string
  aliases?: string[]
  summary?: string
}

interface TipTapEditorProps {
  content: string
  onChange: (markdown: string) => void
  documents?: DocumentRef[]
  tags?: string[]
  onNavigateToDocument?: (documentId: string, heading?: string) => void
  onTagClick?: (tag: string) => void
}

const TipTapEditor = forwardRef<TipTapEditorRef, TipTapEditorProps>(
  function TipTapEditor({ content, onChange, documents = [], tags = [], onNavigateToDocument, onTagClick }, ref) {
    const [viewMode, setViewMode] = useState<'paper' | 'markdown' | 'reading'>('paper')
    const [markdownValue, setMarkdownValue] = useState(content)
    const selectionRef = useRef<{ text: string; from: number; to: number; empty: boolean } | null>(null)
    const editorRef = useRef<ReturnType<typeof useEditor>>(null)
    const { preview, showPreview, hidePreview } = useHoverPreview(documents)

    // /t slash command popup state
    const [tagPickerOpen, setTagPickerOpen] = useState(false)
    const tagPickerOpenRef = useRef(false)
    const [tagPickerPos, setTagPickerPos] = useState({ top: 0, left: 0 })
    const tagPickerSlashPos = useRef<number | null>(null)

    // Keep ref in sync with state so keydown handler always sees current value
    useEffect(() => {
      tagPickerOpenRef.current = tagPickerOpen
    }, [tagPickerOpen])

    const extensions = useMemo(
      () => [
        StarterKit,
        Placeholder.configure({ placeholder: 'Start writing...' }),
        PersistentSelection,
        InternalLink,
        ExternalLink,
        ContentTag,
        FoldHeading,
        FileEmbed,
        Image.configure({ inline: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableCell,
        TableHeader,
      ],
      []
    )

    // Build set of valid document titles (including aliases) and resolution map
    const { validTitles, titleToDoc } = useMemo(() => {
      const titles = new Set<string>()
      const map = new Map<string, DocumentRef>()
      for (const doc of documents) {
        titles.add(doc.title)
        map.set(doc.title, doc)
        for (const alias of doc.aliases || []) {
          if (alias) {
            titles.add(alias)
            map.set(alias, doc)
          }
        }
      }
      return { validTitles: titles, titleToDoc: map }
    }, [documents])

    // Convert markdown to HTML, then post-process [[...]] and #tag syntax
    const initialContent = useMemo(() => {
      const rawHtml = marked.parse(content || '', { async: false }) as string
      return postprocessWikiLinksAndTags(rawHtml, validTitles)
    }, [content, validTitles])

    const closeTagPicker = useCallback(() => {
      setTagPickerOpen(false)
      tagPickerSlashPos.current = null
    }, [])

    const insertTagFromPicker = useCallback((tag: string) => {
      const ed = editorRef.current
      if (!ed || ed.isDestroyed) return
      const slashPos = tagPickerSlashPos.current
      if (slashPos == null) {
        ed.chain().insertContentAt(ed.state.selection.from, {
          type: 'text',
          text: `#${tag}`,
          marks: [{ type: 'contentTag', attrs: { tag } }],
        }).focus().run()
      } else {
        const { from } = ed.state.selection
        ed
          .chain()
          .deleteRange({ from: slashPos, to: from })
          .insertContentAt(slashPos, {
            type: 'text',
            text: `#${tag}`,
            marks: [{ type: 'contentTag', attrs: { tag } }],
          })
          .focus()
          .run()
      }
      closeTagPicker()
    }, [closeTagPicker])

    const editor = useEditor({
      extensions,
      editable: viewMode !== 'reading',
      content: initialContent,
      onCreate: ({ editor }) => {
        editor.storage.documents = documents
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML()
        const md = turndown.turndown(html)
        setMarkdownValue(md)
        onChange(md)

        // Keep documents in sync for file embeds
        editor.storage.documents = documents

        // Check for /t slash command
        const { from, empty } = editor.state.selection
        if (empty) {
          const $from = editor.state.selection.$from
          const blockStart = $from.start()
          const textBefore = editor.state.doc.textBetween(blockStart, from)
          const slashMatch = textBefore.match(/(?:^|\s)\/t$/)
          if (slashMatch) {
            const slashStart = from - 2 // '/t' is 2 chars
            tagPickerSlashPos.current = slashStart
            const coords = editor.view.coordsAtPos(from)
            setTagPickerPos({ top: coords.bottom + 4, left: coords.left })
            setTagPickerOpen(true)
          } else if (tagPickerOpenRef.current) {
            closeTagPicker()
          }
        }
      },
      editorProps: {
        handleClickOn: (_view, _pos, _node, _nodePos, event) => {
          const target = event.target as HTMLElement
          // Internal link click
          if (target.classList.contains('internal-link')) {
            const title = target.getAttribute('data-title') || target.textContent?.replace(/^\[\[/, '').replace(/\]\]$/, '') || ''
            const heading = target.getAttribute('data-heading') || undefined
            const doc = titleToDoc.get(title)
            if (doc && onNavigateToDocument) {
              onNavigateToDocument(doc.id, heading)
              return true
            }
          }
          // Tag click
          if (target.classList.contains('content-tag')) {
            const tag = target.getAttribute('data-tag') || target.textContent?.replace(/^#/, '') || ''
            if (tag && onTagClick) {
              onTagClick(tag)
              return true
            }
          }
          return false
        },
        handleDOMEvents: {
          mouseover: (_view, event) => {
            const target = (event.target as HTMLElement).closest('.internal-link') as HTMLElement | null
            if (target && !target.hasAttribute('data-broken')) {
              const title = target.getAttribute('data-title') || ''
              const doc = titleToDoc.get(title)
              if (doc) {
                showPreview(doc.title, target.getBoundingClientRect())
              }
            }
            return false
          },
          mouseout: (_view, event) => {
            const target = (event.target as HTMLElement).closest('.internal-link') as HTMLElement | null
            const related = (event as MouseEvent).relatedTarget as HTMLElement | null
            if (target) {
              // Don't hide if we're moving to another element inside the same link
              if (related && target.contains(related)) {
                return false
              }
              hidePreview()
            }
            return false
          },
          keydown: (_view, event) => {
            if (event.key === 'Escape' && tagPickerOpenRef.current) {
              event.preventDefault()
              closeTagPicker()
              return true
            }
            return false
          },
        },
      },
      onSelectionUpdate: ({ editor }) => {
        const { from, to, empty } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to, ' ')
        selectionRef.current = { text, from, to, empty }
      },
    })

    editorRef.current = editor

    useImperativeHandle(ref, () => ({
      getSelectionInfo: () => {
        if (!editor || editor.isDestroyed) return null
        const { from, to, empty } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to, ' ')

        // If editor is blurred, read the stored selection from the plugin.
        const pluginState = persistentSelectionKey.getState(editor.state) as
          | { storedSelection: { from: number; to: number } | null }
          | undefined
        if (!editor.isFocused && pluginState?.storedSelection) {
          const stored = pluginState.storedSelection
          const storedText = editor.state.doc.textBetween(stored.from, stored.to, ' ')
          return { text: storedText, from: stored.from, to: stored.to, empty: false }
        }

        // Fallback to live selection
        return { text, from, to, empty }
      },
      replaceSelection: (text: string) => {
        if (!editor || editor.isDestroyed) return
        // Convert markdown to HTML so AI output renders properly in the editor
        const html = postprocessWikiLinksAndTags(marked.parse(text, { async: false }) as string, validTitles)
        editor.chain().focus().insertContent(html).run()
        // Clear the persistent highlight after replacement
        const tr = editor.state.tr.setMeta(persistentSelectionKey, { action: 'clear' })
        editor.view.dispatch(tr)
      },
      insertAtCursor: (text: string) => {
        if (!editor || editor.isDestroyed) return
        // Convert markdown to HTML so AI output renders properly in the editor
        const html = postprocessWikiLinksAndTags(marked.parse(text, { async: false }) as string, validTitles)
        editor.chain().focus().insertContent(html).run()
      },
      appendToEnd: (text: string) => {
        if (!editor || editor.isDestroyed) return
        const html = postprocessWikiLinksAndTags(marked.parse(text, { async: false }) as string)
        // Move to end and insert
        editor.chain().focus().setTextSelection(editor.state.doc.content.size).insertContent(html).run()
      },
      focus: () => {
        if (!editor || editor.isDestroyed) return
        editor.commands.focus()
      },
      isFocused: () => {
        if (!editor || editor.isDestroyed) return false
        return editor.isFocused
      },
      getContent: () => {
        if (!editor || editor.isDestroyed) return ''
        const html = editor.getHTML()
        return turndown.turndown(html)
      },
    }), [editor])

    // Dynamically size .ProseMirror to fill the scroll container so empty docs
    // still show a full-height typing area, while letting it grow with content.
    useEffect(() => {
      if (!editor || editor.isDestroyed) return
      const pm = editor.view.dom as HTMLElement
      const scrollContainer = pm.closest('.overflow-auto') as HTMLElement | null
      if (!scrollContainer) return

      const setMinHeight = () => {
        if (!pm.isConnected) return
        const height = scrollContainer.clientHeight
        if (height > 0) {
          pm.style.minHeight = `${height}px`
        }
      }

      requestAnimationFrame(setMinHeight)
      const ro = new ResizeObserver(setMinHeight)
      ro.observe(scrollContainer)
      return () => {
        ro.disconnect()
        pm.style.minHeight = ''
      }
    }, [editor])

    const handleMarkdownChange = (value: string) => {
      setMarkdownValue(value)
      onChange(value)
      if (editor && !editor.isDestroyed) {
        editor.commands.setContent(
          postprocessWikiLinksAndTags(marked.parse(value || '', { async: false }) as string),
          false
        )
      }
    }

    // Close tag picker on click outside
    const tagPickerRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
      if (!tagPickerOpen) return
      const handleClick = (e: MouseEvent) => {
        if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
          closeTagPicker()
        }
      }
      window.addEventListener('mousedown', handleClick)
      return () => window.removeEventListener('mousedown', handleClick)
    }, [tagPickerOpen, closeTagPicker])

    // Listen for file-embed navigation events from node views
    useEffect(() => {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail as { documentId: string; heading?: string }
        if (detail?.documentId && onNavigateToDocument) {
          onNavigateToDocument(detail.documentId, detail.heading)
        }
      }
      window.addEventListener('file-embed-navigate', handler)
      return () => window.removeEventListener('file-embed-navigate', handler)
    }, [onNavigateToDocument])

    if (!editor) return null

    const FormatButton = ({
      onClick,
      active,
      title,
      children,
    }: {
      onClick: () => void
      active?: boolean
      title: string
      children: React.ReactNode
    }) => (
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={`p-1.5 rounded ${active ? 'bg-accent' : 'hover:bg-accent'} text-muted-foreground`}
        title={title}
      >
        {children}
      </button>
    )

    return (
      <div className="flex flex-col h-full">
        {/* Top toolbar: view mode + history */}
        <div className="flex items-center justify-between p-2 border-b bg-card">
          <div className="flex items-center gap-1">
            <FormatButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
              <Undo className="h-4 w-4" />
            </FormatButton>
            <FormatButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
              <Redo className="h-4 w-4" />
            </FormatButton>
            <div className="w-px h-4 bg-border mx-1" />
            <SpeechMicButton
              onTranscript={(text) => {
                editor.chain().focus().insertContent(text + ' ').run()
              }}
              title="Speech to text"
            />
          </div>

          <div className="flex items-center bg-background rounded-md border p-0.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setViewMode('paper')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'paper' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Paper
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setViewMode('markdown')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'markdown' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              Markdown
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setViewMode('reading')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'reading' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Reading
            </button>
          </div>
        </div>

        {/* /t Tag picker popup */}
        {tagPickerOpen && (
          <div
            ref={tagPickerRef}
            className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[180px] max-h-[240px] overflow-auto"
            style={{ top: tagPickerPos.top, left: tagPickerPos.left }}
          >
            <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
              Insert tag
            </div>
            {tags.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No tags yet</div>
            )}
            {tags.map((tag) => (
              <button
                key={tag}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertTagFromPicker(tag)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
              >
                <Tag className="h-3 w-3 text-muted-foreground" />
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-auto flex flex-col">
          {viewMode === 'markdown' ? (
            <textarea
              value={markdownValue}
              onChange={(e) => handleMarkdownChange(e.target.value)}
              className="w-full flex-1 p-4 bg-background font-mono text-sm leading-relaxed resize-none border-0 focus:outline-none"
              spellCheck={false}
            />
          ) : (
            <div
              onClick={(e) => {
                if (viewMode === 'reading') return
                const target = e.target as HTMLElement
                const pm = target.closest('.ProseMirror')
                if (!pm && editor && !editor.isDestroyed) {
                  editor.commands.focus('end')
                }
              }}
            >
              <EditorContent
                editor={editor}
                className={`prose dark:prose-invert max-w-none focus:outline-none ${
                  viewMode === 'reading' ? 'prose-lg px-8 py-6' : 'prose-sm'
                }`}
              />
            </div>
          )}
        </div>

        {/* Hover preview popover */}
        <HoverPreviewPopover
          x={preview.x}
          y={preview.y}
          title={preview.title}
          text={preview.text}
          summary={preview.summary}
          visible={preview.visible}
        />

        {/* Bottom formatting toolbar */}
        {viewMode !== 'reading' && (
          <div className="flex items-center justify-center gap-1 p-2 border-t bg-card">
            <FormatButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </FormatButton>
            <FormatButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </FormatButton>
            <div className="w-px h-4 bg-border mx-1" />
            <FormatButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive('heading', { level: 1 })}
              title="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </FormatButton>
            <FormatButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive('heading', { level: 2 })}
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </FormatButton>
            <div className="w-px h-4 bg-border mx-1" />
            <FormatButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </FormatButton>
            <FormatButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              title="Ordered List"
            >
              <ListOrdered className="h-4 w-4" />
            </FormatButton>
            <div className="w-px h-4 bg-border mx-1" />
            <FormatButton
              onClick={() => {
                const url = window.prompt('Enter image URL:')
                if (url) editor.chain().focus().setImage({ src: url }).run()
              }}
              title="Insert Image"
            >
              <ImageIcon className="h-4 w-4" />
            </FormatButton>
            <FormatButton
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()}
              title="Insert Table"
            >
              <TableIcon className="h-4 w-4" />
            </FormatButton>
            <FormatButton
              onClick={() => {
                const title = window.prompt('Enter document title to embed:')
                if (title) {
                  editor.chain().focus().insertContent({
                    type: 'fileEmbed',
                    attrs: { title: title.trim() },
                  }).run()
                }
              }}
              title="Insert File Embed"
            >
              <FileText className="h-4 w-4" />
            </FormatButton>
            <FormatButton
              onClick={() => {
                const url = window.prompt('Enter link URL:')
                if (url) {
                  const text = window.prompt('Link text (optional):') || url
                  editor.chain().focus().insertContent({
                    type: 'text',
                    text,
                    marks: [{ type: 'externalLink', attrs: { href: url } }],
                  }).run()
                }
              }}
              title="Insert Link"
            >
              <Link className="h-4 w-4" />
            </FormatButton>
            <div className="w-px h-4 bg-border mx-1" />
            <FormatButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal Rule"
            >
              <Minus className="h-4 w-4" />
            </FormatButton>
            <FormatButton
              onClick={() => editor.chain().focus().setHardBreak().run()}
              title="Hard Break"
            >
              <CornerDownLeft className="h-4 w-4" />
            </FormatButton>
            <div className="w-px h-4 bg-border mx-1" />
            <FormatButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive('blockquote')}
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </FormatButton>
            <FormatButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              active={editor.isActive('codeBlock')}
              title="Code Block"
            >
              <Code className="h-4 w-4" />
            </FormatButton>
          </div>
        )}
      </div>
    )
  }
)

export default TipTapEditor
