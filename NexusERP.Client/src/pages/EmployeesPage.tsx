import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from '../hooks/useEmployees'
import type { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '../types/employee.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; employee: Employee }

type DeleteConfirm =
  | { open: false }
  | { open: true; employee: Employee }

// ── Componente principal ─────────────────────────────────────────────────────

export function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm>({ open: false })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, isError } = useEmployees({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    department: departmentFilter || undefined,
  })

  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const deleteEmployee = useDeleteEmployee()

  const departments = [...new Set((data?.items ?? []).map(e => e.department))].sort()

  async function handleDelete() {
    if (!deleteConfirm.open) return
    await deleteEmployee.mutateAsync(deleteConfirm.employee.id)
    setDeleteConfirm({ open: false })
  }

  function formatSalary(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  function formatDate(iso: string): string {
    const [year, month, day] = iso.split('-')
    return `${day}/${month}/${year}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Empleados</h1>
        <Button onClick={() => setModal({ open: true, mode: 'create' })}>+ Nuevo empleado</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nombre o puesto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={departmentFilter || 'all'} onValueChange={v => { setDepartmentFilter(v === 'all' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="w-[210px]">
            <SelectValue placeholder="Todos los departamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los departamentos</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando...</p>}
      {isError && <p className="py-6 text-center text-sm text-destructive">Error al cargar empleados.</p>}

      {data && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Contratación</TableHead>
                  <TableHead>Salario</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No se encontraron empleados.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map(employee => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="font-medium">{employee.lastName}, {employee.firstName}</div>
                      <div className="text-sm text-muted-foreground">{employee.email}</div>
                    </TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell className="text-sm">{formatDate(employee.hireDate)}</TableCell>
                    <TableCell className="text-sm">{formatSalary(employee.salary)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, mode: 'edit', employee })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ open: true, employee })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</Button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(p => (
                <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)}>{p}</Button>
              ))}
              <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>→</Button>
            </div>
          )}
        </>
      )}

      {modal.open && (
        <EmployeeModal
          mode={modal.mode}
          employee={modal.mode === 'edit' ? modal.employee : null}
          onClose={() => setModal({ open: false })}
          onSave={async (formData) => {
            if (modal.mode === 'create') {
              await createEmployee.mutateAsync(formData as CreateEmployeeRequest)
            } else {
              await updateEmployee.mutateAsync({ id: modal.employee.id, data: formData as UpdateEmployeeRequest })
            }
            setModal({ open: false })
          }}
        />
      )}

      {deleteConfirm.open && (
        <ConfirmDialog
          message={`¿Eliminar a ${deleteConfirm.employee.fullName}? Esta acción no se puede deshacer.`}
          isLoading={deleteEmployee.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ open: false })}
        />
      )}
    </div>
  )
}

// ── Modal crear / editar ─────────────────────────────────────────────────────

type EmployeeModalProps = {
  mode: 'create' | 'edit'
  employee: Employee | null
  onClose: () => void
  onSave: (data: CreateEmployeeRequest | UpdateEmployeeRequest) => Promise<void>
}

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  department: string
  hireDate: string
  salary: string
}

function EmployeeModal({ mode, employee, onClose, onSave }: EmployeeModalProps) {
  const [form, setForm] = useState<FormState>({
    firstName:  employee?.firstName  ?? '',
    lastName:   employee?.lastName   ?? '',
    email:      employee?.email      ?? '',
    phone:      employee?.phone      ?? '',
    position:   employee?.position   ?? '',
    department: employee?.department ?? '',
    hireDate:   employee?.hireDate   ?? '',
    salary:     employee?.salary != null ? String(employee.salary) : '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.email || !form.position || !form.department || !form.hireDate || !form.salary) {
      setError('Completá todos los campos obligatorios.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave({
        firstName:  form.firstName.trim(),
        lastName:   form.lastName.trim(),
        email:      form.email.trim(),
        phone:      form.phone.trim() || null,
        position:   form.position.trim(),
        department: form.department.trim(),
        hireDate:   form.hireDate,
        salary:     parseFloat(form.salary),
      })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 409 ? 'Ya existe un empleado con ese email.' : 'Error inesperado. Intentá de nuevo.')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuevo empleado' : 'Editar empleado'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Nombre *</Label>
              <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} disabled={isSubmitting} />
            </div>
            <div className="grid gap-1.5">
              <Label>Apellido *</Label>
              <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} disabled={isSubmitting} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={isSubmitting} />
          </div>

          <div className="grid gap-1.5">
            <Label>Teléfono (opcional)</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} disabled={isSubmitting} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Puesto *</Label>
              <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} disabled={isSubmitting} />
            </div>
            <div className="grid gap-1.5">
              <Label>Departamento *</Label>
              <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} disabled={isSubmitting} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Fecha de contratación *</Label>
            <Input type="date" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} disabled={isSubmitting} />
          </div>

          <div className="grid gap-1.5">
            <Label>Salario *</Label>
            <Input
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.salary}
              onChange={e => setForm({ ...form, salary: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Diálogo de confirmación ──────────────────────────────────────────────────

type ConfirmDialogProps = {
  message: string
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ message, isLoading, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar eliminación</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
