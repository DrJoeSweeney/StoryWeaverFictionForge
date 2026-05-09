import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import FileEmbedNodeView from '../FileEmbedNodeView'

/**
 * TipTap Node for file embeds / transclusion:
 *   ![[Document Name]]
 *   ![[Document Name#Heading]]
 *
 * Renders a read-only panel showing the linked document's content.
 */
export const FileEmbed = Node.create({
  name: 'fileEmbed',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') || '',
        renderHTML: (attributes) =>
          attributes.title ? { 'data-title': attributes.title } : {},
      },
      heading: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-heading') || null,
        renderHTML: (attributes) =>
          attributes.heading ? { 'data-heading': attributes.heading } : {},
      },
      display: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-display') || null,
        renderHTML: (attributes) =>
          attributes.display ? { 'data-display': attributes.display } : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="file-embed"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'file-embed' }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileEmbedNodeView)
  },
})

export default FileEmbed
