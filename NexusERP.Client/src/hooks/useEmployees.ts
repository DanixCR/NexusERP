import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../services/employeeService'
import type { CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeQueryParams } from '../types/employee.types'

export function useEmployees(params?: EmployeeQueryParams) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => employeeService.getAll(params),
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEmployeeRequest) => employeeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeRequest }) =>
      employeeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => employeeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
