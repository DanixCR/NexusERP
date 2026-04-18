export type Employee = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  position: string
  department: string
  hireDate: string
  salary: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateEmployeeRequest = {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  position: string
  department: string
  hireDate: string
  salary: number
}

export type UpdateEmployeeRequest = CreateEmployeeRequest

export type EmployeeQueryParams = {
  page?: number
  pageSize?: number
  search?: string
  department?: string
}
