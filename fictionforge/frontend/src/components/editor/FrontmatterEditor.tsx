import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Plus, X, Tag, List, Type, Hash, ToggleLeft } from 'lucide-react'

interface DocumentRef {
  id: string
  title: string
}

interface FrontmatterEditorProps {
  frontmatter: Record<string, any>
  systemFields?: string[]
  existingKeys?: string[]
  documents?: DocumentRef[]
  onChange: (frontmatter: Record<string, any>) => void
  onNavigateToDocument?: (docId: string, heading?: string) => void
}

const DEFAULT_SYSTEM_FIELDS = [
  'id', 'created_at', 'updated_at', 'project_id', 'word_count',
  'content', 'doc_type', 'module', 'classification', 'parent_id',
  'sort_order', 'title', 'name', 'category', 'role', 'archetype',
  'age', 'appearance', 'personality', 'background', 'goals',
  'conflicts', 'voice_description', 'notes', 'children',
]

type FieldType = 'string' | 'number' | 'boolean' | 'list'

function inferType(value: any): FieldType {
  if (value === null || value === undefined) return 'string'
  if (Array.isArray(value)) return 'list'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'string'
}

function isRenderableValue(value: any): boolean {
  if (value === null || value === undefined) return true
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return true
  if (Array.isArray(value)) return value.every((v) => typeof v !== 'object')
  return false
}

function stringifyValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function parseValue(raw: string, targetType: FieldType): any {
  const trimmed = raw.trim()
  if (trimmed === '') {
    if (targetType === 'list') return []
    if (targetType === 'number') return 0
    if (targetType === 'boolean') return false
    return ''
  }
  if (targetType === 'boolean') {
    return trimmed.toLowerCase() === 'true'
  }
  if (targetType === 'number') {
    const n = Number(trimmed)
    return isNaN(n) ? trimmed : n
  }
  if (targetType === 'list') {
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return trimmed
}

function parseWikiLinks(text: string, documents: DocumentRef[], onNavigate?: (docId: string, heading?: string) => void) {
  const parts: JSX.Element[] = []
  const regex = /\[\[([^\]|]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g
  let lastIndex = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, title, heading, display] = match
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>)
    }
    const doc = documents.find((d) => d.title.toLowerCase() === title.toLowerCase())
    const label = display || (heading ? `${title}#${heading}` : title)
    if (doc && onNavigate) {
      parts.push(
        <a
          key={key++}
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onNavigate(doc.id, heading)
          }}
          className="text-primary underline hover:text-primary/80"
        >
          {label}
        </a>
      )
    } else {
      parts.push(<span key={key++} className="text-muted-foreground">{label}</span>)
    }
    lastIndex = match.index + fullMatch.length
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>)
  }

  return parts.length > 0 ? parts : <span>{text}</span>
}

export default function FrontmatterEditor({
  frontmatter,
  systemFields = DEFAULT_SYSTEM_FIELDS,
  existingKeys = [],
  documents = [],
  onChange,
  onNavigateToDocument,
}: FrontmatterEditorProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('string')
  const [showAddField, setShowAddField] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editKeyValue, setEditKeyValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const editableFields = Object.entries(frontmatter).filter(
    ([key, value]) => !systemFields.includes(key) && isRenderableValue(value)
  )

  const filteredSuggestions = useMemo(() => {
    if (!newFieldKey.trim()) return []
    const q = newFieldKey.toLowerCase()
    return existingKeys
      .filter((k) => k.toLowerCase().includes(q) && !systemFields.includes(k) && !(k in frontmatter))
      .slice(0, 8)
  }, [newFieldKey, existingKeys, systemFields, frontmatter])

  useEffect(() => {
    if (showAddField && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showAddField])

  const updateField = useCallback(
    (key: string, value: any) => {
      onChange({ ...frontmatter, [key]: value })
    },
    [frontmatter, onChange]
  )

  const removeField = useCallback(
    (key: string) => {
      const next = { ...frontmatter }
      delete next[key]
      onChange(next)
    },
    [frontmatter, onChange]
  )

  const changeFieldType = useCallback(
    (key: string, newType: FieldType) => {
      const current = frontmatter[key]
      let converted: any
      if (newType === 'list') converted = current ? [stringifyValue(current)] : []
      else if (newType === 'boolean') converted = Boolean(current)
      else if (newType === 'number') {
        const n = Number(stringifyValue(current))
        converted = isNaN(n) ? 0 : n
      } else {
        converted = stringifyValue(current)
      }
      onChange({ ...frontmatter, [key]: converted })
      setShowTypeMenu(null)
    },
    [frontmatter, onChange]
  )

  const addField = useCallback(() => {
    const key = newFieldKey.trim()
    if (!key) return
    let value: any = newFieldValue.trim()
    if (newFieldType === 'list') {
      value = value ? value.split(',').map((s: string) => s.trim()).filter(Boolean) : []
    } else if (newFieldType === 'boolean') {
      value = value.toLowerCase() === 'true'
    } else if (newFieldType === 'number') {
      const n = Number(value)
      value = isNaN(n) ? 0 : n
    }
    onChange({ ...frontmatter, [key]: value })
    setNewFieldKey('')
    setNewFieldValue('')
    setNewFieldType('string')
    setShowAddField(false)
  }, [frontmatter, newFieldKey, newFieldValue, newFieldType, onChange])

  const renderListEditor = (key: string, values: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {values.map((val, i) => (
        <span
          key={`${key}-${val}-${i}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
            key === 'tags' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          {key === 'tags' && <Tag className="h-3 w-3" />}
          {val}
          <button
            onClick={() => updateField(key, values.filter((_, idx) => idx !== i))}
            className="hover:text-destructive"
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        placeholder="Add..."
        className="w-20 px-2 py-0.5 text-xs bg-transparent border-b border-border focus:outline-none focus:border-primary"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const val = e.currentTarget.value.trim()
            if (val) {
              updateField(key, [...values, val])
              e.currentTarget.value = ''
            }
          }
        }}
        onBlur={(e) => {
          const val = e.currentTarget.value.trim()
          if (val) {
            updateField(key, [...values, val])
            e.currentTarget.value = ''
          }
        }}
      />
    </div>
  )

  const renderFieldInput = (key: string, value: any) => {
    const fieldType = inferType(value)

    if (fieldType === 'list') {
      return renderListEditor(key, value)
    }

    if (fieldType === 'boolean') {
      return (
        <button
          onClick={() => updateField(key, !value)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          {value ? 'True' : 'False'}
        </button>
      )
    }

    if (fieldType === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => updateField(key, parseValue(e.target.value, 'number'))}
          className="w-full px-2 py-1 text-xs bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )
    }

    // String with potential wiki-links
    const strVal = stringifyValue(value)
    if (documents.length > 0 && strVal.includes('[[')) {
      return (
        <div className="w-full px-2 py-1 text-xs bg-transparent border rounded min-h-[1.75rem]">
          {parseWikiLinks(strVal, documents, onNavigateToDocument)}
        </div>
      )
    }

    return (
      <input
        type="text"
        value={strVal}
        onChange={(e) => updateField(key, parseValue(e.target.value, 'string'))}
        className="w-full px-2 py-1 text-xs bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-primary"
      />
    )
  }

  const typeMenu = (key: string, currentType: FieldType) => (
    <div className="absolute z-10 mt-1 bg-popover border rounded-md shadow-md py-1 min-w-[120px]">
      {([
        { type: 'string' as FieldType, icon: Type, label: 'Text' },
        { type: 'number' as FieldType, icon: Hash, label: 'Number' },
        { type: 'boolean' as FieldType, icon: ToggleLeft, label: 'Boolean' },
        { type: 'list' as FieldType, icon: List, label: 'List' },
      ]).map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => changeFieldType(key, type)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent ${
            currentType === type ? 'text-primary font-medium' : 'text-foreground'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="border-b bg-card/50">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Properties
          {editableFields.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded-full">
              {editableFields.length}
            </span>
          )}
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {editableFields.map(([key, value]) => {
            const fieldType = inferType(value)
            return (
              <div key={key} className="flex items-start gap-2 group">
                <div className="relative w-24 shrink-0">
                  {editingKey === key ? (
                    <input
                      value={editKeyValue}
                      onChange={(e) => setEditKeyValue(e.target.value)}
                      onBlur={() => {
                        const newKey = editKeyValue.trim()
                        if (newKey && newKey !== key && !systemFields.includes(newKey) && !(newKey in frontmatter)) {
                          const next = { ...frontmatter }
                          next[newKey] = next[key]
                          delete next[key]
                          onChange(next)
                        }
                        setEditingKey(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur()
                        }
                      }}
                      autoFocus
                      className="w-full px-1 py-0.5 text-xs bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingKey(key)
                        setEditKeyValue(key)
                      }}
                      className="w-full text-left text-xs text-muted-foreground pt-1.5 truncate hover:text-foreground"
                      title={key}
                    >
                      {key}
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {renderFieldInput(key, value)}
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="relative">
                    <button
                      onClick={() => setShowTypeMenu(showTypeMenu === key ? null : key)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                      title="Change type"
                    >
                      {fieldType === 'list' && <List className="h-3 w-3" />}
                      {fieldType === 'boolean' && <ToggleLeft className="h-3 w-3" />}
                      {fieldType === 'number' && <Hash className="h-3 w-3" />}
                      {fieldType === 'string' && <Type className="h-3 w-3" />}
                    </button>
                    {showTypeMenu === key && typeMenu(key, fieldType)}
                  </div>
                  <button
                    onClick={() => removeField(key)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    title="Remove property"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}

          {editableFields.length === 0 && !showAddField && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No properties yet
            </p>
          )}

          {showAddField ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-start gap-2">
                <div className="relative w-24 shrink-0">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Property name"
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addField()}
                    className="w-full px-2 py-1 text-xs bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {filteredSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-40 bg-popover border rounded-md shadow-md py-1">
                      {filteredSuggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setNewFieldKey(s)
                            inputRef.current?.focus()
                          }}
                          className="w-full text-left px-3 py-1 text-xs hover:bg-accent truncate"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder={newFieldType === 'list' ? 'Value (comma = array)' : 'Value'}
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addField()}
                    className="flex-1 px-2 py-1 text-xs bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                    className="px-2 py-1 text-xs bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Bool</option>
                    <option value="list">List</option>
                  </select>
                  <button
                    onClick={addField}
                    disabled={!newFieldKey.trim()}
                    className="p-1 text-primary hover:bg-primary/10 rounded disabled:opacity-30"
                    title="Add property"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddField(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add property
            </button>
          )}
        </div>
      )}
    </div>
  )
}
