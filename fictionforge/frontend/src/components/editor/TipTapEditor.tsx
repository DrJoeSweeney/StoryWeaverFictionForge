import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { persistentSelectionKey, PersistentSelection } from './PersistentSelection'
import { InternalLink } from './extensions/InternalLink'
import { ContentTag } from './extensions/Tag'
import EditorAutocomplete from './EditorAutocomplete'
import SpeechMicButton from '@/components/SpeechMicButton'
import {
  Bold, Italic, Heading1, Heading2, Heading3, Heading4, List, ListOrdered,
  Quote, Code, Undo, Redo, Eye, FileCode
} from 'lucide-react'

/**
 * Post-process HTML produced by marked to convert wiki-link and tag syntax
 * into HTML that TipTap can parse via our custom extensions.
 */
function postprocessWikiLinksAndTags(html: string): string {
  // [[Document Name]] → <a class="internal-link">[[Document Name]]</a>
  const result = html.replace(
    /\[\[([^\]]+)\]\]/g,
    '<a class="internal-link" data-title="$1">[[$1]]</a>'
  )
  // #tag → <span class="content-tag">#tag</span>
  // Matches # followed by word characters (alphanumeric + underscore).
  return result.replace(
    /(^|\s)#(\w+)\b/g,
    '$1<span class="content-tag" data-tag="$2">#$2</span>'
  )
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

// Preserve internal links as [[Title]] in markdown output
turndown.addRule('internalLink', {
  filter: (node) =>
    node.nodeName === 'A' && node.classList.contains('internal-link'),
  replacement: (content) => content,
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
  focus: () => void
  isFocused: () => boolean
  getContent: () => string
}

interface DocumentRef {
  id: string
  title: string
}

interface TipTapEditorProps {
  content: string
  onChange: (markdown: string) => void
  documents?: DocumentRef[]
  tags?: string[]
  onNavigateToDocument?: (documentId: string) => void
  onTagClick?: (tag: string) => void
}

const TipTapEditor = forwardRef<TipTapEditorRef, TipTapEditorProps>(
  function TipTapEditor({ content, onChange, documents = [], tags = [], onNavigateToDocument, onTagClick }, ref) {
    const [viewMode, setViewMode] = useState<'paper' | 'markdown'>('paper')
    const [markdownValue, setMarkdownValue] = useState(content)
    const isUpdatingRef = useRef(false)
    const selectionRef = useRef<{ text: string; from: number; to: number; empty: boolean } | null>(null)

    const extensions = useMemo(
      () => [
        StarterKit,
        Placeholder.configure({ placeholder: 'Start writing...' }),
        PersistentSelection,
        InternalLink,
        ContentTag,
      ],
      []
    )

    // Convert markdown to HTML, then post-process [[...]] and #tag syntax
    const initialContent = useMemo(() => {
      const rawHtml = marked.parse(content || '', { async: false }) as string
      return postprocessWikiLinksAndTags(rawHtml)
    }, [])

    const editor = useEditor({
      extensions,
      content: initialContent,
      onUpdate: ({ editor }) => {
        if (isUpdatingRef.current) return
        const html = editor.getHTML()
        const md = turndown.turndown(html)
        setMarkdownValue(md)
        onChange(md)
      },
      editorProps: {
        handleClickOn: (_view, _pos, _node, _nodePos, event) => {
          const target = event.target as HTMLElement
          // Internal link click
          if (target.classList.contains('internal-link')) {
            const title = target.getAttribute('data-title') || target.textContent?.replace(/^\[\[/, '').replace(/\]\]$/, '') || ''
            const doc = documents.find((d) => d.title === title)
            if (doc && onNavigateToDocument) {
              onNavigateToDocument(doc.id)
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
      },
      onSelectionUpdate: ({ editor }) => {
        const { from, to, empty } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to, ' ')
        selectionRef.current = { text, from, to, empty }
      },
    })

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
        editor.chain().focus().insertContent(text).run()
        // Clear the persistent highlight after replacement
        const tr = editor.state.tr.setMeta(persistentSelectionKey, { action: 'clear' })
        editor.view.dispatch(tr)
      },
      insertAtCursor: (text: string) => {
        if (!editor || editor.isDestroyed) return
        editor.chain().focus().insertContent(text).run()
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

    // Sync external content changes (e.g., AI insert, initial load)
    // Never reset while the editor is focused (user is typing)
    useEffect(() => {
      if (!editor || editor.isDestroyed || editor.isFocused) return

      const currentMd = turndown.turndown(editor.getHTML())
      if (currentMd !== content) {
        isUpdatingRef.current = true
        editor.commands.setContent(
          postprocessWikiLinksAndTags(marked.parse(content || '', { async: false }) as string),
          false
        )
        setMarkdownValue(content)
        requestAnimationFrame(() => {
          isUpdatingRef.current = false
        })
      }
    }, [content, editor])

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
          </div>
        </div>

        {/* Autocomplete floating popover */}
        <EditorAutocomplete editor={editor} documents={documents} tags={tags} />

        {/* Editor */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'paper' ? (
            <EditorContent
              editor={editor}
              className="prose prose-sm dark:prose-invert max-w-none p-4 h-full focus:outline-none"
            />
          ) : (
            <textarea
              value={markdownValue}
              onChange={(e) => handleMarkdownChange(e.target.value)}
              className="w-full h-full p-4 bg-background font-mono text-sm leading-relaxed resize-none focus:outline-none"
              spellCheck={false}
            />
          )}
        </div>

        {/* Bottom formatting toolbar */}
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
          <FormatButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </FormatButton>
          <FormatButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            active={editor.isActive('heading', { level: 4 })}
            title="Heading 4"
          >
            <Heading4 className="h-4 w-4" />
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
      </div>
    )
  }
)

export default TipTapEditor
