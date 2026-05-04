import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * TipTap Mark for internal wiki-style links:
 *   [[Document Name]]
 *   [[Document Name|Display Text]]
 *   [[Document Name#Heading]]
 *   [[Document Name#Heading|Display Text]]
 *
 * Rendered as an <a> with class "internal-link". Clicking navigates
 * to the target document (handled by the editor shell).
 */
export const InternalLink = Mark.create({
  name: 'internalLink',

  parseHTML() {
    return [{ tag: 'a.internal-link' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { class: 'internal-link' }), 0]
  },

  addAttributes() {
    return {
      targetId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-target-id'),
        renderHTML: (attributes) =>
          attributes.targetId
            ? { 'data-target-id': attributes.targetId }
            : {},
      },
      title: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-title') || element.textContent || '',
        renderHTML: (attributes) =>
          attributes.title ? { 'data-title': attributes.title } : {},
      },
      heading: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-heading'),
        renderHTML: (attributes) =>
          attributes.heading ? { 'data-heading': attributes.heading } : {},
      },
      displayText: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-display'),
        renderHTML: (attributes) =>
          attributes.displayText ? { 'data-display': attributes.displayText } : {},
      },
    }
  },
})

export default InternalLink
