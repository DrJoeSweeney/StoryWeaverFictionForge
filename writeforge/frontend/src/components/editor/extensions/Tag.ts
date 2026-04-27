import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * TipTap Mark for content tags: #my-tag
 *
 * Rendered as a <span> with class "content-tag".
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
})

export default ContentTag
