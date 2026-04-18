export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical'
export type TicketStatus   = 'Open' | 'InProgress' | 'Resolved' | 'Closed'

export type Ticket = {
  id: string
  title: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  category: string
  clientId: string | null
  clientName: string | null
  assignedEmployeeId: string | null
  assignedEmployeeName: string | null
  createdAt: string
  updatedAt: string
}

export type CreateTicketRequest = {
  title: string
  description: string
  priority: TicketPriority
  category: string
  clientId: string | null
  assignedEmployeeId: string | null
}

export type UpdateTicketRequest = CreateTicketRequest

export type ChangeTicketStatusRequest = {
  status: TicketStatus
}

export type TicketQueryParams = {
  page?: number
  pageSize?: number
  search?: string
  status?: TicketStatus
  priority?: TicketPriority
  clientId?: string
  assignedEmployeeId?: string
}
