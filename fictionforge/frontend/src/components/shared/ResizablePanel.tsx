import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'

interface ResizablePanelProps {
  side: 'left' | 'right'
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  collapsedWidth?: number
  storageKey: string
  className?: string
  children: React.ReactNode
}

export default function ResizablePanel({
  side,
  defaultWidth = 240,
  minWidth = 180,
  maxWidth = 600,
  collapsedWidth = 36,
  storageKey,
  className = '',
  children,
}: ResizablePanelProps) {
  const fullStorageKey = `ff_panel_${storageKey}`
  const collapsedStorageKey = `${fullStorageKey}_collapsed`

  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(fullStorageKey)
      return saved ? Math.max(minWidth, Math.min(maxWidth, parseInt(saved, 10))) : defaultWidth
    } catch {
      return defaultWidth
    }
  })

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(collapsedStorageKey)
      return saved === 'true'
    } catch {
      return false
    }
  })

  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)

  useEffect(() => {
    try {
      localStorage.setItem(fullStorageKey, String(width))
    } catch { /* ignore */ }
  }, [width, fullStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(collapsedStorageKey, String(isCollapsed))
    } catch { /* ignore */ }
  }, [isCollapsed, collapsedStorageKey])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = side === 'left'
        ? moveEvent.clientX - startXRef.current
        : startXRef.current - moveEvent.clientX
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [side, minWidth, maxWidth, width])

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  // Collapsed state: render a thin strip with just the chevron
  if (isCollapsed) {
    return (
      <div
        style={{ width: collapsedWidth }}
        className={`shrink-0 h-full hidden lg:flex flex-col items-center py-3 bg-card border rounded-lg overflow-hidden ${className}`}
      >
        <button
          onClick={toggleCollapse}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground transition-colors"
          title={side === 'left' ? 'Expand panel' : 'Expand panel'}
        >
          {side === 'left' ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
        <div className="flex-1" />
        <GripVertical className="h-3 w-3 text-muted-foreground opacity-30 rotate-90" />
        <div className="flex-1" />
      </div>
    )
  }

  // Expanded state: render children with resize handle
  return (
    <div
      style={{ width }}
      className={`shrink-0 h-full hidden lg:flex flex-col bg-card border rounded-lg overflow-hidden ${className}`}
    >
      <div className="flex flex-row h-full overflow-hidden">
        {/* For right panel, resize handle goes on the left */}
        {side === 'right' && (
          <ResizeHandle
            side={side}
            onMouseDown={handleMouseDown}
            onToggleCollapse={toggleCollapse}
            isResizing={isResizing}
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {children}
        </div>

        {/* For left panel, resize handle goes on the right */}
        {side === 'left' && (
          <ResizeHandle
            side={side}
            onMouseDown={handleMouseDown}
            onToggleCollapse={toggleCollapse}
            isResizing={isResizing}
          />
        )}
      </div>
    </div>
  )
}

function ResizeHandle({
  side,
  onMouseDown,
  onToggleCollapse,
  isResizing,
}: {
  side: 'left' | 'right'
  onMouseDown: (e: React.MouseEvent) => void
  onToggleCollapse: () => void
  isResizing: boolean
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        relative w-4 shrink-0 cursor-col-resize
        flex items-center justify-center
        hover:bg-accent/60
        ${isResizing ? 'bg-accent/80' : 'bg-transparent'}
        transition-colors
        group
      `}
      title="Drag to resize"
    >
      {/* Visual grip line */}
      <div className={`
        absolute inset-y-0 w-px
        ${isResizing ? 'bg-primary' : 'bg-border group-hover:bg-primary/50'}
        transition-colors
      `} />

      {/* Chevron collapse button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleCollapse()
        }}
        className={`
          z-10 p-0.5 rounded hover:bg-accent
          text-muted-foreground hover:text-foreground
          opacity-0 group-hover:opacity-100
          ${isResizing ? 'opacity-100' : ''}
          transition-opacity
        `}
        title={side === 'left' ? 'Collapse to left' : 'Collapse to right'}
      >
        {side === 'left' ? (
          <ChevronLeft className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
