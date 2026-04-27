import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

export function useProjectTags(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-tags', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await api.get<string[]>(`/projects/${projectId}/tags`)
      return res.data
    },
    enabled: !!projectId,
  })
}
