export type UserListItem = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'Admin' | 'User'
  isActive: boolean
  createdAt: string
}

export type UpdateProfileRequest = {
  firstName: string
  lastName: string
}

export type ChangePasswordRequest = {
  currentPassword: string
  newPassword: string
}

export type CreateUserRequest = {
  email: string
  firstName: string
  lastName: string
  password: string
  role: 'Admin' | 'User'
}

export type UpdateUserRoleRequest = {
  role: 'Admin' | 'User'
}
