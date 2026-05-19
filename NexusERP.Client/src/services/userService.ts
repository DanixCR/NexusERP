import { apiClient } from '../lib/axios'
import type { User } from '../types/auth.types'
import type {
  UserListItem,
  UpdateProfileRequest,
  ChangePasswordRequest,
  CreateUserRequest,
  UpdateUserRoleRequest,
} from '../types/user.types'

export const userService = {
  getProfile(): Promise<User> {
    return apiClient.get<User>('/users/me').then(r => r.data)
  },

  updateProfile(data: UpdateProfileRequest): Promise<User> {
    return apiClient.put<User>('/users/me', data).then(r => r.data)
  },

  changePassword(data: ChangePasswordRequest): Promise<void> {
    return apiClient.put('/users/me/password', data).then(() => undefined)
  },

  getAll(): Promise<UserListItem[]> {
    return apiClient.get<UserListItem[]>('/users').then(r => r.data)
  },

  createUser(data: CreateUserRequest): Promise<UserListItem> {
    return apiClient.post<UserListItem>('/users', data).then(r => r.data)
  },

  updateRole(id: string, data: UpdateUserRoleRequest): Promise<UserListItem> {
    return apiClient.put<UserListItem>(`/users/${id}/role`, data).then(r => r.data)
  },

  setActive(id: string, isActive: boolean): Promise<UserListItem> {
    return apiClient.put<UserListItem>(`/users/${id}/active`, { isActive }).then(r => r.data)
  },
}
