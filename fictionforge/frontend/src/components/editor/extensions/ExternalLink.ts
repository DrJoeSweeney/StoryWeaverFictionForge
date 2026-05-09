import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * TipTap Mark for external markdown links:
 *   [text](https://example.com)
 *
 * Rendered as <a href="..." target="_blank" rel="noopener noreferrer">.
 * Only matches <a> tags that are NOT internal-link or content-tag.
 */
export const ExternalLink = Mark.create({
  name: 'externalLink',

  parseHTML() {
    return [
      {
        tag: 'a',
        getAttrs: (element) => {
          const el = element as HTMLAnchorElement
          // Skip internal links and content tags
          if (el.classList.contains('internal-link')) return false
          if (el.classList.contains('content-tag')) return false
          if (!el.getAttribute('href')) return false
          return {}
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
      0,
    ]
  },

  addAttributes() {
    return {
      href: {
        default: '',
        parseHTML: (element) => element.getAttribute('href'),
        renderHTML: (attributes) =>
          attributes.href ? { href: attributes.href } : {},
      },
    }
  },
})

export default ExternalLink
