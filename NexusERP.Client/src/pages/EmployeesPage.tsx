import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from '../hooks/useEmployees'
import type { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '../types/employee.types'

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
  const navigate = useNavigate()
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

  function handleDepartmentFilterChange(value: string) {
    setDepartmentFilter(value)
    setPage(1)
  }

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
    <div className="page-container">
      {/* Cabecera */}
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>← Volver al dashboard</button>
        <h1>Empleados</h1>
        <button className="btn-primary" onClick={() => setModal({ open: true, mode: 'create' })}>
          + Nuevo empleado
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="Buscar por nombre o puesto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={departmentFilter}
          onChange={e => handleDepartmentFilterChange(e.target.value)}
        >
          <option value="">Todos los departamentos</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {isLoading && <p className="state-message">Cargando...</p>}
      {isError && <p className="state-message error">Error al cargar empleados.</p>}

      {data && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Puesto</th>
                  <th>Departamento</th>
                  <th>Contratación</th>
                  <th>Salario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No se encontraron empleados.
                    </td>
                  </tr>
                )}
                {data.items.map(employee => (
                  <tr key={employee.id}>
                    <td>
                      <div className="cell-primary">{employee.lastName}, {employee.firstName}</div>
                      <div className="cell-secondary">{employee.email}</div>
                    </td>
                    <td>{employee.position}</td>
                    <td>{employee.department}</td>
                    <td>{formatDate(employee.hireDate)}</td>
                    <td>{formatSalary(employee.salary)}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon"
                        title="Editar"
                        onClick={() => setModal({ open: true, mode: 'edit', employee })}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        title="Eliminar"
                        onClick={() => setDeleteConfirm({ open: true, employee })}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={p === page ? 'active' : ''}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          )}
        </>
      )}

      {/* Modal crear / editar */}
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

      {/* Confirmación de eliminación */}
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
      if (status === 409) {
        setError('Ya existe un empleado con ese email.')
      } else {
        setError('Error inesperado. Intentá de nuevo.')
      }
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'create' ? 'Nuevo empleado' : 'Editar empleado'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm({ ...form, firstName: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label>Apellido *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm({ ...form, lastName: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Teléfono (opcional)</label>
            <input
              type="text"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Puesto *</label>
              <input
                type="text"
                value={form.position}
                onChange={e => setForm({ ...form, position: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label>Departamento *</label>
              <input
                type="text"
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Fecha de contratación *</label>
            <input
              type="date"
              value={form.hireDate}
              onChange={e => setForm({ ...form, hireDate: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Salario *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.salary}
              onChange={e => setForm({ ...form, salary: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card confirm-dialog" onClick={e => e.stopPropagation()}>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={isLoading}>Cancelar</button>
          <button className="btn-danger" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
