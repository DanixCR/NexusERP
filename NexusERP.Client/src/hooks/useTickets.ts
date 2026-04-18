import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketService } from '../services/ticketService'
import type {
  CreateTicketRequest,
  UpdateTicketRequest,
  ChangeTicketStatusRequest,
  TicketQueryParams,
} from '../types/ticket.types'

export function useTickets(params?: TicketQueryParams) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: () => ticketService.getAll(params),
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTicketRequest) => ticketService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTicketRequest }) =>
      ticketService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useChangeTicketStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeTicketStatusRequest }) =>
      ticketService.changeStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ticketService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
