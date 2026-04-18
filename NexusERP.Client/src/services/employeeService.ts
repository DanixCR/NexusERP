import { apiClient } from '../lib/axios'
import type { Employee, CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeQueryParams } from '../types/employee.types'
import type { PagedResponse } from '../types/client.types'

export const employeeService = {
  getAll(params?: EmployeeQueryParams): Promise<PagedResponse<Employee>> {
    return apiClient.get<PagedResponse<Employee>>('/employees', { params }).then(r => r.data)
  },

  getById(id: string): Promise<Employee> {
    return apiClient.get<Employee>(`/employees/${id}`).then(r => r.data)
  },

  create(data: CreateEmployeeRequest): Promise<Employee> {
    return apiClient.post<Employee>('/employees', data).then(r => r.data)
  },

  update(id: string, data: UpdateEmployeeRequest): Promise<Employee> {
    return apiClient.put<Employee>(`/employees/${id}`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/employees/${id}`).then(() => undefined)
  },
}
