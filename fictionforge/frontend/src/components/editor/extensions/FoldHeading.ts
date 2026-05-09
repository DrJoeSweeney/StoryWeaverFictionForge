import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const foldHeadingKey = new PluginKey('foldHeading')

interface FoldHeadingState {
  collapsed: Set<number>
}

/**
 * TipTap extension that adds fold/unfold toggles to headings.
 *
 * Click the chevron next to a heading to collapse all content until
 * the next heading of the same or higher level.
 */
export const FoldHeading = Extension.create({
  name: 'foldHeading',

  addProseMirrorPlugins() {
    return [
      new Plugin<FoldHeadingState>({
        key: foldHeadingKey,

        state: {
          init() {
            return { collapsed: new Set() }
          },
          apply(tr, value) {
            const meta = tr.getMeta(foldHeadingKey)
            if (meta?.toggle) {
              const next = new Set(value.collapsed)
              if (next.has(meta.pos)) {
                next.delete(meta.pos)
              } else {
                next.add(meta.pos)
              }
              return { collapsed: next }
            }
            // Map positions through transactions
            const next = new Set<number>()
            for (const pos of value.collapsed) {
              const mapped = tr.mapping.map(pos)
              if (mapped >= 0) next.add(mapped)
            }
            return { collapsed: next }
          },
        },

        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              const target = event.target as HTMLElement
              if (target.classList.contains('fold-toggle')) {
                event.preventDefault()
                const pos = parseInt(target.getAttribute('data-pos') || '-1')
                if (pos >= 0) {
                  view.dispatch(
                    view.state.tr.setMeta(foldHeadingKey, { toggle: true, pos })
                  )
                }
                return true
              }
              return false
            },
          },

          decorations(state) {
            const pluginState = foldHeadingKey.getState(state) as
              | FoldHeadingState
              | undefined

            const decorations: Decoration[] = []

            // Add toggle widgets to all headings
            state.doc.descendants((node, pos) => {
              if (node.type.name.startsWith('heading')) {
                const isCollapsed = pluginState?.collapsed.has(pos) ?? false
                const widget = document.createElement('span')
                widget.className = `fold-toggle ${
                  isCollapsed ? 'fold-collapsed' : 'fold-expanded'
                }`
                widget.textContent = isCollapsed ? '▶' : '▼'
                widget.setAttribute('data-pos', String(pos))
                decorations.push(
                  Decoration.widget(pos, () => widget, { side: -1 })
                )
              }
            })

            // Hide content for collapsed headings
            if (pluginState && pluginState.collapsed.size > 0) {
              for (const pos of pluginState.collapsed) {
                const headingNode = state.doc.nodeAt(pos)
                if (
                  !headingNode ||
                  !headingNode.type.name.startsWith('heading')
                )
                  continue

                const headingLevel = headingNode.attrs.level as number
                const start = pos + headingNode.nodeSize
                let end = state.doc.content.size

                // Find next heading of same or higher level
                state.doc.nodesBetween(start, state.doc.content.size, (
                  node,
                  nodePos
                ) => {
                  if (
                    node.type.name.startsWith('heading') &&
                    node.attrs.level <= headingLevel
                  ) {
                    end = nodePos
                    return false
                  }
                })

                // Hide all block nodes in the range
                state.doc.nodesBetween(start, end, (node, nodePos) => {
                  if (
                    node.isBlock &&
                    !node.type.name.startsWith('heading') &&
                    node.type.name !== 'doc'
                  ) {
                    decorations.push(
                      Decoration.node(nodePos, nodePos + node.nodeSize, {
                        class: 'folded-hidden',
                      })
                    )
                  }
                })
              }
            }

            return decorations.length > 0
              ? DecorationSet.create(state.doc, decorations)
              : null
          },
        },
      }),
    ]
  },
})

export default FoldHeading
