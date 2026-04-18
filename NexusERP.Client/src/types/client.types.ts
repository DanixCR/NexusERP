export type Client = {
  id: string
  name: string
  email: string
  phone: string
  taxId: string
  address: string | null
  createdAt: string   // ISO 8601
  updatedAt: string
}

export type CreateClientRequest = {
  name: string
  email: string
  phone: string
  taxId: string
  address: string | null
}

export type UpdateClientRequest = CreateClientRequest

export type ClientQueryParams = {
  page?: number
  pageSize?: number
  search?: string
}

export type PagedResponse<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}
