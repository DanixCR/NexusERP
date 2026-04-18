import { apiClient } from '../lib/axios'
import type {
  Ticket,
  CreateTicketRequest,
  UpdateTicketRequest,
  ChangeTicketStatusRequest,
  TicketQueryParams,
} from '../types/ticket.types'
import type { PagedResponse } from '../types/client.types'

export const ticketService = {
  getAll(params?: TicketQueryParams): Promise<PagedResponse<Ticket>> {
    return apiClient.get<PagedResponse<Ticket>>('/tickets', { params }).then(r => r.data)
  },

  getById(id: string): Promise<Ticket> {
    return apiClient.get<Ticket>(`/tickets/${id}`).then(r => r.data)
  },

  create(data: CreateTicketRequest): Promise<Ticket> {
    return apiClient.post<Ticket>('/tickets', data).then(r => r.data)
  },

  update(id: string, data: UpdateTicketRequest): Promise<Ticket> {
    return apiClient.put<Ticket>(`/tickets/${id}`, data).then(r => r.data)
  },

  changeStatus(id: string, data: ChangeTicketStatusRequest): Promise<Ticket> {
    return apiClient.patch<Ticket>(`/tickets/${id}/status`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/tickets/${id}`).then(() => undefined)
  },
}
