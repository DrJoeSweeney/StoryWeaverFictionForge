import { useState, useMemo, useCallback, useRef } from 'react'
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  ArrowRight,
} from 'lucide-react'

export interface TreeItem {
  id: string
  title: string
  parent_id: string | null
  sort_order: number
  children?: TreeItem[]
  [key: string]: any
}

interface DraggableTreePanelProps {
  items: TreeItem[]
  selectedId?: string | null
  onSelect: (item: TreeItem) => void
  onReorder: (itemIds: string[]) => void
  onNest: (itemId: string, parentId: string | null) => void
  renderIcon?: (item: TreeItem) => React.ReactNode
  renderBadge?: (item: TreeItem) => React.ReactNode
  emptyMessage?: string
  className?: string
}

function buildTree(flatItems: TreeItem[]): TreeItem[] {
  const map = new Map<string, TreeItem>()
  const roots: TreeItem[] = []

  for (const item of flatItems) {
    map.set(item.id, { ...item, children: [] })
  }

  for (const item of flatItems) {
    const node = map.get(item.id)!
    if (item.parent_id && map.has(item.parent_id)) {
      const parent = map.get(item.parent_id)!
      parent.children = parent.children || []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortLevel = (nodes: TreeItem[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        sortLevel(node.children)
      }
    }
  }
  sortLevel(roots)

  return roots
}

function flattenVisibleTree(
  nodes: TreeItem[],
  expandedIds: Set<string>,
  level = 0
): Array<{ item: TreeItem; level: number; hasChildren: boolean }> {
  const result: Array<{ item: TreeItem; level: number; hasChildren: boolean }> = []
  for (const node of nodes) {
    const hasChildren = (node.children?.length ?? 0) > 0
    result.push({ item: node, level, hasChildren })
    if (hasChildren && expandedIds.has(node.id)) {
      result.push(...flattenVisibleTree(node.children!, expandedIds, level + 1))
    }
  }
  return result
}

export default function DraggableTreePanel({
  items,
  selectedId,
  onSelect,
  onReorder,
  onNest,
  renderIcon,
  renderBadge,
  emptyMessage = 'No items yet',
  className = '',
}: DraggableTreePanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | 'into' | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOverPosRef = useRef<'before' | 'after' | 'into' | null>(null)

  const tree = useMemo(() => buildTree(items), [items])
  const visibleRows = useMemo(
    () => flattenVisibleTree(tree, expandedIds),
    [tree, expandedIds]
  )

  const toggleExpand = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    },
    []
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, item: TreeItem) => {
      setDraggingId(item.id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', item.id)
      // Hide the default drag ghost for cleaner UX
      const el = e.currentTarget as HTMLElement
      if (el) {
        e.dataTransfer.setDragImage(el, 0, 0)
      }
    },
    []
  )

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setDragOverId(null)
    setDragOverPosition(null)
    dragOverPosRef.current = null
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetItem: TreeItem) => {
      e.preventDefault()
      if (draggingId === targetItem.id) return

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const offsetY = e.clientY - rect.top
      const height = rect.height

      let pos: 'before' | 'after' | 'into'
      if (offsetY < height * 0.25) {
        pos = 'before'
      } else if (offsetY > height * 0.75) {
        pos = 'after'
      } else {
        pos = 'into'
      }
      dragOverPosRef.current = pos
      setDragOverPosition(pos)
      setDragOverId(targetItem.id)
    },
    [draggingId]
  )

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
    setDragOverPosition(null)
    dragOverPosRef.current = null
  }, [])

  // Prevent dropping an ancestor onto its own descendant
  const isDescendant = useCallback(
    (ancestorId: string, itemId: string): boolean => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return false
      if (item.parent_id === ancestorId) return true
      if (item.parent_id) return isDescendant(ancestorId, item.parent_id)
      return false
    },
    [items]
  )

  // Get all siblings of an item (items with the same parent)
  const getSiblings = useCallback(
    (parentId: string | null) => {
      return items
        .filter((i) => i.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
    },
    [items]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, targetItem: TreeItem) => {
      e.preventDefault()
      e.stopPropagation()
      const sourceId = e.dataTransfer.getData('text/plain') || draggingId
      const position = dragOverPosRef.current

      setDragOverId(null)
      setDragOverPosition(null)
      dragOverPosRef.current = null
      setDraggingId(null)

      if (!sourceId || sourceId === targetItem.id) return
      if (isDescendant(sourceId, targetItem.id)) return

      if (position === 'into') {
        // Nest source under target
        onNest(sourceId, targetItem.id)
        // Reorder: append source to end of target's children
        const targetChildren = getSiblings(targetItem.id).map((c) => c.id)
        const newOrder = [...targetChildren, sourceId]
        onReorder(newOrder)
        setExpandedIds((prev) => {
          const next = new Set(prev)
          next.add(targetItem.id)
          return next
        })
        return
      }

      // before / after: reorder within target's sibling group
      const targetParentId = targetItem.parent_id
      const siblings = getSiblings(targetParentId)
      let siblingIds = siblings.map((s) => s.id)

      // Remove source from current position in siblings
      siblingIds = siblingIds.filter((id) => id !== sourceId)

      // Find target's index in the filtered list
      const targetIdx = siblingIds.indexOf(targetItem.id)

      // Insert source before or after target
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
      siblingIds.splice(insertIdx, 0, sourceId)

      // If source is moving to a different parent, update parent_id
      const sourceItem = items.find((i) => i.id === sourceId)
      if (sourceItem && sourceItem.parent_id !== targetParentId) {
        onNest(sourceId, targetParentId)
      }

      onReorder(siblingIds)
    },
    [draggingId, isDescendant, getSiblings, items, onNest, onReorder]
  )

  const handleDropOnContainer = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const sourceId = e.dataTransfer.getData('text/plain') || draggingId
      setDragOverId(null)
      setDragOverPosition(null)
      dragOverPosRef.current = null
      setDraggingId(null)

      if (!sourceId) return

      const sourceItem = items.find((i) => i.id === sourceId)
      if (!sourceItem || sourceItem.parent_id === null) return

      // Un-nest to root: append to end of root siblings
      const rootSiblings = getSiblings(null)
      const newOrder = [...rootSiblings.map((s) => s.id), sourceId]
      onNest(sourceId, null)
      onReorder(newOrder)
    },
    [draggingId, items, getSiblings, onNest, onReorder]
  )

  if (visibleRows.length === 0) {
    return (
      <div
        className={`p-4 text-sm text-muted-foreground text-center border-2 border-dashed border-border rounded-md ${className}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropOnContainer}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col ${className}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropOnContainer}
    >
      {visibleRows.map(({ item, level, hasChildren }) => {
        const isSelected = selectedId === item.id
        const isExpanded = expandedIds.has(item.id)
        const isDragOver = dragOverId === item.id
        const isDragging = draggingId === item.id
        const position = isDragOver ? dragOverPosition : null

        return (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, item)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item)}
            className="relative"
          >
            {/* Drop zone indicator — BEFORE */}
            {isDragOver && position === 'before' && (
              <div className="absolute -top-1 left-0 right-0 z-10 flex items-center gap-1 pointer-events-none">
                <div className="h-0.5 flex-1 bg-primary rounded-full" />
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Move before
                </span>
                <div className="h-0.5 flex-1 bg-primary rounded-full" />
              </div>
            )}

            {/* Drop zone indicator — INTO */}
            {isDragOver && position === 'into' && (
              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-end pr-3">
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Nest inside
                </span>
              </div>
            )}

            {/* Drop zone indicator — AFTER */}
            {isDragOver && position === 'after' && (
              <div className="absolute -bottom-1 left-0 right-0 z-10 flex items-center gap-1 pointer-events-none">
                <div className="h-0.5 flex-1 bg-primary rounded-full" />
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Move after
                </span>
                <div className="h-0.5 flex-1 bg-primary rounded-full" />
              </div>
            )}

            {/* Row content */}
            <div
              className={`
                flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer select-none transition-colors
                ${isSelected ? 'bg-accent ring-1 ring-primary' : 'hover:bg-accent'}
                ${isDragging ? 'opacity-40' : ''}
                ${isDragOver && position === 'into' ? 'bg-primary/10 ring-1 ring-primary/50' : ''}
              `}
              style={{ marginLeft: `${level * 16}px` }}
              onClick={() => onSelect(item)}
            >
              <GripVertical
                className="h-4 w-4 text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0 hover:text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              />

              {hasChildren ? (
                <button
                  type="button"
                  className="p-0.5 shrink-0 hover:bg-accent rounded"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpand(item.id)
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}

              {renderIcon ? (
                renderIcon(item)
              ) : hasChildren ? (
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              )}

              <span className="flex-1 text-sm truncate">{item.title}</span>

              {renderBadge && renderBadge(item)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
