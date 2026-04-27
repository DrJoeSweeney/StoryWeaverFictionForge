import { useCallback, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, Trash2 } from 'lucide-react'

interface CanvasNodeData {
  id: string
  node_type: string
  label: string
  data: string | null
  position_x: number
  position_y: number
  width: number
  height: number
  color: string | null
  document_id: string | null
  character_id: string | null
}

interface CanvasEdgeData {
  id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  edge_type: string
}

const NODE_COLORS: Record<string, string> = {
  scene: '#dbeafe',
  character: '#dcfce7',
  note: '#fef3c7',
  image: '#f3e8ff',
}

export default function CanvasPage({ projectId }: { projectId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [showNewNode, setShowNewNode] = useState(false)
  const [newNodeData, setNewNodeData] = useState({ label: '', node_type: 'note', color: '' })
  const queryClient = useQueryClient()

  const { data: canvasNodes, isLoading } = useQuery({
    queryKey: ['canvas-nodes', projectId],
    queryFn: async () => {
      const res = await api.get<CanvasNodeData[]>(`/canvas/project/${projectId}/nodes`)
      return res.data
    },
  })

  const { data: canvasEdges } = useQuery({
    queryKey: ['canvas-edges', projectId],
    queryFn: async () => {
      const res = await api.get<CanvasEdgeData[]>(`/canvas/project/${projectId}/edges`)
      return res.data
    },
  })

  useEffect(() => {
    if (canvasNodes) {
      const n = canvasNodes.map((cn): Node => ({
        id: cn.id,
        type: 'default',
        position: { x: cn.position_x, y: cn.position_y },
        data: { label: cn.label, type: cn.node_type },
        style: {
          background: cn.color || NODE_COLORS[cn.node_type] || '#fff',
          width: cn.width || 200,
          height: cn.height || 100,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 8,
        },
      }))
      setNodes(n)
    }
  }, [canvasNodes, setNodes])

  useEffect(() => {
    if (canvasEdges) {
      const e = canvasEdges.map((ce): Edge => ({
        id: ce.id,
        source: ce.source_node_id,
        target: ce.target_node_id,
        label: ce.label || undefined,
        type: 'default',
      }))
      setEdges(e)
    }
  }, [canvasEdges, setEdges])

  const createNodeMutation = useMutation({
    mutationFn: (data: Partial<CanvasNodeData>) =>
      api.post(`/canvas/project/${projectId}/nodes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-nodes', projectId] })
      setShowNewNode(false)
      setNewNodeData({ label: '', node_type: 'note', color: '' })
    },
  })

  const createEdgeMutation = useMutation({
    mutationFn: (data: Partial<CanvasEdgeData>) =>
      api.post(`/canvas/project/${projectId}/edges`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-edges', projectId] })
    },
  })

  const deleteNodeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/canvas/nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-nodes', projectId] })
      setSelectedNode(null)
    },
  })

  const updateNodeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CanvasNodeData> }) =>
      api.put(`/canvas/nodes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-nodes', projectId] })
    },
  })

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        createEdgeMutation.mutate({
          source_node_id: connection.source,
          target_node_id: connection.target,
          label: '',
          edge_type: 'related',
        })
        setEdges((eds) => addEdge(connection, eds))
      }
    },
    [createEdgeMutation, setEdges]
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      updateNodeMutation.mutate({
        id: node.id,
        data: {
          position_x: node.position.x,
          position_y: node.position.y,
        },
      })
    },
    [updateNodeMutation]
  )

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNodeData.label.trim()) return
    createNodeMutation.mutate({
      label: newNodeData.label,
      node_type: newNodeData.node_type,
      color: newNodeData.color || NODE_COLORS[newNodeData.node_type] || undefined,
      position_x: Math.random() * 400 + 50,
      position_y: Math.random() * 300 + 50,
      width: 200,
      height: 100,
    })
  }

  if (isLoading) return <div className="text-center py-12">Loading graph...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Graph</h2>
        <div className="flex items-center gap-2">
          {selectedNode && (
            <button
              onClick={() => deleteNodeMutation.mutate(selectedNode.id)}
              className="flex items-center gap-1 px-3 py-2 border rounded-md text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete Node
            </button>
          )}
          <button
            onClick={() => setShowNewNode(!showNewNode)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Node
          </button>
        </div>
      </div>

      {showNewNode && (
        <form onSubmit={handleCreateNode} className="p-3 bg-card rounded-lg border space-y-2">
          <div className="flex gap-2">
            <input
              value={newNodeData.label}
              onChange={(e) => setNewNodeData({ ...newNodeData, label: e.target.value })}
              placeholder="Node label"
              className="flex-1 px-2 py-1 border rounded bg-background text-sm"
              required
            />
            <select
              value={newNodeData.node_type}
              onChange={(e) => setNewNodeData({ ...newNodeData, node_type: e.target.value })}
              className="px-2 py-1 border rounded bg-background text-sm"
            >
              <option value="note">Note</option>
              <option value="scene">Scene</option>
              <option value="character">Character</option>
              <option value="image">Image</option>
            </select>
            <button type="submit" className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">Add</button>
            <button type="button" onClick={() => setShowNewNode(false)} className="px-3 py-1 border rounded text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="h-[600px] bg-card rounded-lg border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNode(node)}
          onPaneClick={() => setSelectedNode(null)}
          onNodeDragStop={onNodeDragStop}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="p-3 bg-card rounded-lg border">
          <p className="text-sm font-medium">Selected: {selectedNode.data?.label as string}</p>
          <p className="text-xs text-muted-foreground">Type: {(selectedNode.data?.type as string) || 'note'}</p>
        </div>
      )}
    </div>
  )
}
