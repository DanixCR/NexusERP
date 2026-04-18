import { apiClient } from '../lib/axios'
import type { PagedResponse } from '../types/client.types'
import type { Project, CreateProjectRequest, UpdateProjectRequest, ProjectQueryParams } from '../types/project.types'

export const projectService = {
  getAll(params?: ProjectQueryParams): Promise<PagedResponse<Project>> {
    return apiClient.get<PagedResponse<Project>>('/projects', { params }).then(r => r.data)
  },

  getById(id: string): Promise<Project> {
    return apiClient.get<Project>(`/projects/${id}`).then(r => r.data)
  },

  create(data: CreateProjectRequest): Promise<Project> {
    return apiClient.post<Project>('/projects', data).then(r => r.data)
  },

  update(id: string, data: UpdateProjectRequest): Promise<Project> {
    return apiClient.put<Project>(`/projects/${id}`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/projects/${id}`).then(() => undefined)
  },
}
