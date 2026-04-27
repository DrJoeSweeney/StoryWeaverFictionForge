import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const persistentSelectionKey = new PluginKey('persistentSelection')

export interface PersistentSelectionState {
  storedSelection: { from: number; to: number } | null
  mouseSelecting: boolean
}

/**
 * TipTap extension that renders a persistent highlight over the last
 * non-empty selection when the editor loses focus.
 *
 * This gives word-processor behaviour: the user can move focus to other
 * controls on the page and the selected text remains visibly highlighted.
 */
export const PersistentSelection = Extension.create({
  name: 'persistentSelection',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin<PersistentSelectionState>({
        key: persistentSelectionKey,

        state: {
          init() {
            return { storedSelection: null, mouseSelecting: false }
          },

          apply(tr, value) {
            const meta = tr.getMeta(persistentSelectionKey)
            let next: PersistentSelectionState = { ...value }

            // Map existing stored selection through the transaction
            if (next.storedSelection) {
              const mappedFrom = tr.mapping.map(next.storedSelection.from)
              const mappedTo = tr.mapping.map(next.storedSelection.to)
              // Only keep if the range is still valid and non-empty
              if (mappedFrom < mappedTo && mappedTo <= tr.doc.content.size) {
                next.storedSelection = { from: mappedFrom, to: mappedTo }
              } else {
                next.storedSelection = null
              }
            }

            if (meta?.action === 'store') {
              const { from, to, empty } = tr.selection
              if (!empty && from < to) {
                next.storedSelection = { from, to }
              }
            } else if (meta?.action === 'clear') {
              next.storedSelection = null
            } else if (meta?.mouseSelecting !== undefined) {
              next.mouseSelecting = meta.mouseSelecting
            }

            return next
          },
        },

        props: {
          handleDOMEvents: {
            mousedown: (view) => {
              view.dispatch(
                view.state.tr.setMeta(persistentSelectionKey, {
                  mouseSelecting: true,
                })
              )
              return false
            },
            mouseup: (view) => {
              view.dispatch(
                view.state.tr.setMeta(persistentSelectionKey, {
                  mouseSelecting: false,
                })
              )
              return false
            },
            // When focus returns, clear the persistent highlight so the
            // native selection can take over.
            focus: (view) => {
              const pluginState = persistentSelectionKey.getState(view.state)
              if (pluginState?.storedSelection) {
                view.dispatch(
                  view.state.tr.setMeta(persistentSelectionKey, {
                    action: 'clear',
                  })
                )
              }
              return false
            },
            // When leaving the editor, store the current selection.
            blur: (view) => {
              const { from, to, empty } = view.state.selection
              if (!empty && from < to) {
                view.dispatch(
                  view.state.tr.setMeta(persistentSelectionKey, {
                    action: 'store',
                  })
                )
              }
              return false
            },
          },

          decorations(state) {
            const pluginState = persistentSelectionKey.getState(state) as
              | PersistentSelectionState
              | undefined

            if (!pluginState) return null

            // While the editor is focused, let the native selection show.
            if (editor.isFocused) return null

            // Don't fight the native selection while the user is dragging.
            if (pluginState.mouseSelecting) return null

            const stored = pluginState.storedSelection
            if (!stored || stored.from >= stored.to) return null

            // Use inline decorations for text-level highlighting.
            // Using an inclusive spec ({} as third arg) makes the decoration
            // survive cursor placement at its edges.
            return DecorationSet.create(state.doc, [
              Decoration.inline(
                stored.from,
                stored.to,
                { class: 'selection-persistent' },
                { inclusiveStart: true, inclusiveEnd: true }
              ),
            ])
          },
        },
      }),
    ]
  },
})

export default PersistentSelection
