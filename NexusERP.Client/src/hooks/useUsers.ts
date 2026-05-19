import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '../services/userService'
import type {
  UpdateProfileRequest,
  ChangePasswordRequest,
  CreateUserRequest,
  UpdateUserRoleRequest,
} from '../types/user.types'

const USERS_KEY = ['users']

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => userService.getAll(),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserRequest) => userService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRoleRequest }) =>
      userService.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}

export function useSetUserActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userService.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => userService.updateProfile(data),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => userService.changePassword(data),
  })
}
