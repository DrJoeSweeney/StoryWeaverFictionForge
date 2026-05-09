import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * Scan the document for #tag patterns and return inline decorations.
 * This provides live highlighting for tags that were typed manually
 * (not inserted via autocomplete) without modifying the document.
 */
function computeTagDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = []
  const regex = /(^|\s|>)#([a-zA-Z0-9_/-]+)(?![a-zA-Z0-9_/-])/g

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return
    const text = node.text
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const tagStart = pos + match.index + match[1].length
      const tagEnd = tagStart + 1 + match[2].length
      decorations.push(
        Decoration.inline(tagStart, tagEnd, { class: 'content-tag' })
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

/**
 * TipTap Mark for content tags: #my-tag
 *
 * Rendered as a <span> with class "content-tag".
 * The mark is applied on initial load (via parseHTML) and by explicit
 * commands (e.g., TagSuggestion autocomplete). We do NOT apply it
 * aggressively during typing to avoid truncation bugs.
 */
export const ContentTag = Mark.create({
  name: 'contentTag',

  parseHTML() {
    return [{ tag: 'span.content-tag' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'content-tag' }), 0]
  },

  addAttributes() {
    return {
      tag: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-tag'),
        renderHTML: (attributes) =>
          attributes.tag ? { 'data-tag': attributes.tag } : {},
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tagDecorations'),
        state: {
          init(_, { doc }) {
            return computeTagDecorations(doc)
          },
          apply(tr, value) {
            if (!tr.docChanged) {
              return value.map(tr.mapping, tr.doc)
            }
            return computeTagDecorations(tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

export default ContentTag
