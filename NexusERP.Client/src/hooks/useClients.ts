import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientService } from '../services/clientService'
import type { CreateClientRequest, UpdateClientRequest, ClientQueryParams } from '../types/client.types'

const CLIENTS_KEY = (params?: ClientQueryParams) => ['clients', params]

export function useClients(params?: ClientQueryParams) {
  return useQuery({
    queryKey: CLIENTS_KEY(params),
    queryFn: () => clientService.getAll(params),
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateClientRequest) => clientService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientRequest }) =>
      clientService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => clientService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
