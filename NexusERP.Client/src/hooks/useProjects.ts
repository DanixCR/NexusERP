import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectService } from '../services/projectService'
import { clientService } from '../services/clientService'
import { employeeService } from '../services/employeeService'
import type { CreateProjectRequest, UpdateProjectRequest, ProjectQueryParams } from '../types/project.types'

export function useProjects(params?: ProjectQueryParams) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => projectService.getAll(params),
  })
}

// Carga todos los clientes activos para el selector del modal.
// staleTime de 1 minuto evita refetches innecesarios al abrir/cerrar el modal.
export function useAllClients() {
  return useQuery({
    queryKey: ['clients-all'],
    queryFn: () => clientService.getAll({ page: 1, pageSize: 200 }),
    staleTime: 60_000,
  })
}

export function useAllEmployees() {
  return useQuery({
    queryKey: ['employees-all'],
    queryFn: () => employeeService.getAll({ page: 1, pageSize: 200 }),
    staleTime: 60_000,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectRequest) => projectService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) =>
      projectService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
