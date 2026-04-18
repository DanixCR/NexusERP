import { apiClient } from '../lib/axios'
import type { Client, CreateClientRequest, UpdateClientRequest, ClientQueryParams, PagedResponse } from '../types/client.types'

export const clientService = {
  getAll(params?: ClientQueryParams): Promise<PagedResponse<Client>> {
    return apiClient.get<PagedResponse<Client>>('/clients', { params }).then(r => r.data)
  },

  getById(id: string): Promise<Client> {
    return apiClient.get<Client>(`/clients/${id}`).then(r => r.data)
  },

  create(data: CreateClientRequest): Promise<Client> {
    return apiClient.post<Client>('/clients', data).then(r => r.data)
  },

  update(id: string, data: UpdateClientRequest): Promise<Client> {
    return apiClient.put<Client>(`/clients/${id}`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/clients/${id}`).then(() => undefined)
  },
}
