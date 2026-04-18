export type ProjectStatus = 'Pending' | 'InProgress' | 'Completed' | 'Cancelled'

export type Project = {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  startDate: string | null   // ISO 8601 o null
  dueDate: string | null
  budget: number | null
  clientId: string
  clientName: string
  createdAt: string
  updatedAt: string
}

export type CreateProjectRequest = {
  name: string
  description: string | null
  clientId: string
  startDate: string | null
  dueDate: string | null
  budget: number | null
}

export type UpdateProjectRequest = {
  name: string
  description: string | null
  clientId: string
  status: ProjectStatus
  startDate: string | null
  dueDate: string | null
  budget: number | null
}

export type ProjectQueryParams = {
  page?: number
  pageSize?: number
  search?: string
  status?: ProjectStatus
  clientId?: string
}
