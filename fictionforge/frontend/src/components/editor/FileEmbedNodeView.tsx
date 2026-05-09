import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { marked } from 'marked'
import { FileText } from 'lucide-react'

interface DocumentRef {
  id: string
  title: string
  content?: string
  aliases?: string[]
}

export default function FileEmbedNodeView(props: NodeViewProps) {
  const { node, editor, selected } = props
  const title = (node.attrs.title as string) || ''
  const heading = node.attrs.heading as string | undefined

  const docs = (editor.storage.documents || []) as DocumentRef[]
  const doc = docs.find(
    (d) => d.title === title || d.aliases?.includes(title)
  )

  const handleClick = () => {
    const titleAttr = doc?.title || title
    const target = docs.find((d) => d.title === titleAttr)
    if (target && editor.options.onNavigateToDocument) {
      // This won't work directly — navigation is handled by parent.
      // Instead, dispatch a custom event that the parent can listen to.
      const event = new CustomEvent('file-embed-navigate', {
        detail: { documentId: target.id, heading },
      })
      window.dispatchEvent(event)
    }
  }

  if (!doc) {
    return (
      <NodeViewWrapper
        className={`file-embed file-embed-broken ${selected ? 'file-embed-selected' : ''}`}
      >
        <div className="flex items-center gap-2 text-sm text-destructive">
          <FileText className="h-4 w-4" />
          <span>Broken embed: ![[{title}]]</span>
        </div>
      </NodeViewWrapper>
    )
  }

  let content = doc.content || ''

  // If heading is specified, extract from that heading onward
  if (heading) {
    const headingRegex = new RegExp(`^#{1,6}\\s+${heading}\\s*$`, 'm')
    const match = content.match(headingRegex)
    if (match && match.index !== undefined) {
      content = content.slice(match.index)
    }
  }

  // Truncate preview
  const maxLen = 800
  const isTruncated = content.length > maxLen
  const preview = content.slice(0, maxLen)

  // Render markdown to HTML for preview
  const previewHtml = marked.parse(preview, { async: false }) as string

  return (
    <NodeViewWrapper
      className={`file-embed ${selected ? 'file-embed-selected' : ''}`}
      onClick={handleClick}
    >
      <div className="file-embed-header">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="file-embed-title">{doc.title}</span>
        {heading && (
          <span className="file-embed-heading">#{heading}</span>
        )}
        {isTruncated && (
          <span className="file-embed-truncated">(truncated)</span>
        )}
      </div>
      <div
        className="file-embed-body prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
    </NodeViewWrapper>
  )
}
