import { useState } from 'react'
import type { FormEvent } from 'react'
import { useUsers, useCreateUser, useUpdateUserRole, useSetUserActive } from '../hooks/useUsers'
import { useAuth } from '@/hooks/useAuth'
import type { UserListItem, CreateUserRequest } from '../types/user.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Tipos de estado local ────────────────────────────────────────────────────

type RoleConfirm =
  | { open: false }
  | { open: true; user: UserListItem; newRole: 'Admin' | 'User' }

type ActiveConfirm =
  | { open: false }
  | { open: true; user: UserListItem; newActive: boolean }

const EMPTY_FORM: CreateUserRequest = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  role: 'User',
}

// ── Componente principal ─────────────────────────────────────────────────────

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const { data: users, isLoading, isError } = useUsers()

  const [createOpen, setCreateOpen] = useState(false)
  const [roleConfirm, setRoleConfirm] = useState<RoleConfirm>({ open: false })
  const [activeConfirm, setActiveConfirm] = useState<ActiveConfirm>({ open: false })

  const createUser = useCreateUser()
  const updateRole = useUpdateUserRole()
  const setActive = useSetUserActive()

  async function handleRoleConfirm() {
    if (!roleConfirm.open) return
    await updateRole.mutateAsync({ id: roleConfirm.user.id, data: { role: roleConfirm.newRole } })
    setRoleConfirm({ open: false })
  }

  async function handleActiveConfirm() {
    if (!activeConfirm.open) return
    await setActive.mutateAsync({ id: activeConfirm.user.id, isActive: activeConfirm.newActive })
    setActiveConfirm({ open: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gestión de usuarios</h1>
        <Button onClick={() => setCreateOpen(true)}>+ Nuevo usuario</Button>
      </div>

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando...</p>}
      {isError && <p className="py-6 text-center text-sm text-destructive">Error al cargar usuarios.</p>}

      {users && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No hay usuarios.
                  </TableCell>
                </TableRow>
              )}
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.lastName}, {u.firstName}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'Admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.isActive ? 'outline' : 'destructive'}
                      className={u.isActive ? 'border-green-600 text-green-600' : ''}
                    >
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString('es-CR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Select
                        value={u.role}
                        onValueChange={(val) => {
                          if (u.id === currentUser?.id) return
                          setRoleConfirm({ open: true, user: u, newRole: val as 'Admin' | 'User' })
                        }}
                        disabled={u.id === currentUser?.id}
                      >
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="User">User</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant={u.isActive ? 'outline' : 'default'}
                        size="sm"
                        className="text-xs"
                        disabled={u.id === currentUser?.id}
                        onClick={() => setActiveConfirm({ open: true, user: u, newActive: !u.isActive })}
                      >
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onSave={async (data) => {
            await createUser.mutateAsync(data)
            setCreateOpen(false)
          }}
        />
      )}

      {roleConfirm.open && (
        <Dialog open onOpenChange={(o) => { if (!o) setRoleConfirm({ open: false }) }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Cambiar rol</DialogTitle>
              <DialogDescription>
                ¿Cambiar el rol de <strong>{roleConfirm.user.firstName} {roleConfirm.user.lastName}</strong> a <strong>{roleConfirm.newRole}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleConfirm({ open: false })} disabled={updateRole.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleRoleConfirm} disabled={updateRole.isPending}>
                {updateRole.isPending ? 'Guardando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {activeConfirm.open && (
        <Dialog open onOpenChange={(o) => { if (!o) setActiveConfirm({ open: false }) }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {activeConfirm.newActive ? 'Activar usuario' : 'Desactivar usuario'}
              </DialogTitle>
              <DialogDescription>
                ¿{activeConfirm.newActive ? 'Activar' : 'Desactivar'} a{' '}
                <strong>{activeConfirm.user.firstName} {activeConfirm.user.lastName}</strong>?
                {!activeConfirm.newActive && ' Su sesión activa se cerrará.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveConfirm({ open: false })} disabled={setActive.isPending}>
                Cancelar
              </Button>
              <Button
                variant={activeConfirm.newActive ? 'default' : 'destructive'}
                onClick={handleActiveConfirm}
                disabled={setActive.isPending}
              >
                {setActive.isPending ? 'Guardando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ── Modal crear usuario ──────────────────────────────────────────────────────

type CreateUserModalProps = {
  onClose: () => void
  onSave: (data: CreateUserRequest) => Promise<void>
}

function CreateUserModal({ onClose, onSave }: CreateUserModalProps) {
  const [form, setForm] = useState<CreateUserRequest>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.email || !form.firstName || !form.lastName || !form.password) {
      setError('Completá todos los campos obligatorios.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 409 ? 'Ya existe un usuario con ese email.' : 'Error inesperado.')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Nombre *</Label>
              <Input
                value={form.firstName}
                onChange={e => setForm({ ...form, firstName: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Apellido *</Label>
              <Input
                value={form.lastName}
                onChange={e => setForm({ ...form, lastName: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Contraseña *</Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Rol</Label>
            <Select
              value={form.role}
              onValueChange={(val) => setForm({ ...form, role: val as 'Admin' | 'User' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
