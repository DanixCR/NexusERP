import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects, useAllClients, useCreateProject, useUpdateProject, useDeleteProject } from '../hooks/useProjects'
import type { Project, ProjectStatus, CreateProjectRequest, UpdateProjectRequest } from '../types/project.types'

// ── Indicador visual de estado ───────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  Pending:    { label: 'Pendiente',    className: 'badge-gray'  },
  InProgress: { label: 'En progreso', className: 'badge-blue'  },
  Completed:  { label: 'Completado',  className: 'badge-green' },
  Cancelled:  { label: 'Cancelado',   className: 'badge-red'   },
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = STATUS_CONFIG[status]
  return <span className={`status-badge ${className}`}>{label}</span>
}

// ── Tipos de estado local ────────────────────────────────────────────────────

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; project: Project }

type DeleteConfirm =
  | { open: false }
  | { open: true; project: Project }

// ── Componente principal ─────────────────────────────────────────────────────

export function ProjectsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('')
  const [clientFilter, setClientFilter] = useState('')
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

  const { data, isLoading, isError } = useProjects({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    clientId: clientFilter || undefined,
  })

  const { data: clientsData } = useAllClients()

  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as ProjectStatus | '')
    setPage(1)
  }

  function handleClientFilterChange(value: string) {
    setClientFilter(value)
    setPage(1)
  }

  async function handleDelete() {
    if (!deleteConfirm.open) return
    await deleteProject.mutateAsync(deleteConfirm.project.id)
    setDeleteConfirm({ open: false })
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="page-container">
      {/* Cabecera */}
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>← Volver al dashboard</button>
        <h1>Proyectos</h1>
        <button className="btn-primary" onClick={() => setModal({ open: true, mode: 'create' })}>
          + Nuevo proyecto
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="Buscar por nombre o descripción..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => handleStatusFilterChange(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="Pending">Pendiente</option>
          <option value="InProgress">En progreso</option>
          <option value="Completed">Completado</option>
          <option value="Cancelled">Cancelado</option>
        </select>
        <select
          className="filter-select"
          value={clientFilter}
          onChange={e => handleClientFilterChange(e.target.value)}
        >
          <option value="">Todos los clientes</option>
          {clientsData?.items.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {isLoading && <p className="state-message">Cargando...</p>}
      {isError && <p className="state-message error">Error al cargar proyectos.</p>}

      {data && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Inicio</th>
                  <th>Vencimiento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No se encontraron proyectos.
                    </td>
                  </tr>
                )}
                {data.items.map(project => (
                  <tr key={project.id}>
                    <td>
                      <div className="cell-primary">{project.name}</div>
                      {project.description && (
                        <div className="cell-secondary">{project.description}</div>
                      )}
                    </td>
                    <td>{project.clientName}</td>
                    <td><StatusBadge status={project.status} /></td>
                    <td>{formatDate(project.startDate)}</td>
                    <td>{formatDate(project.dueDate)}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon"
                        title="Editar"
                        onClick={() => setModal({ open: true, mode: 'edit', project })}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        title="Eliminar"
                        onClick={() => setDeleteConfirm({ open: true, project })}
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
        <ProjectModal
          mode={modal.mode}
          project={modal.mode === 'edit' ? modal.project : null}
          clients={clientsData?.items ?? []}
          onClose={() => setModal({ open: false })}
          onSave={async (formData) => {
            if (modal.mode === 'create') {
              await createProject.mutateAsync(formData as CreateProjectRequest)
            } else {
              await updateProject.mutateAsync({ id: modal.project.id, data: formData as UpdateProjectRequest })
            }
            setModal({ open: false })
          }}
        />
      )}

      {/* Confirmación de eliminación */}
      {deleteConfirm.open && (
        <ConfirmDialog
          message={`¿Eliminar el proyecto "${deleteConfirm.project.name}"? Esta acción no se puede deshacer.`}
          isLoading={deleteProject.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ open: false })}
        />
      )}
    </div>
  )
}

// ── Modal crear / editar ─────────────────────────────────────────────────────

type ClientOption = { id: string; name: string }

type ProjectModalProps = {
  mode: 'create' | 'edit'
  project: Project | null
  clients: ClientOption[]
  onClose: () => void
  onSave: (data: CreateProjectRequest | UpdateProjectRequest) => Promise<void>
}

type FormState = {
  name: string
  description: string
  clientId: string
  status: ProjectStatus
  startDate: string
  dueDate: string
  budget: string   // string en el form, se convierte a number | null al enviar
}

function ProjectModal({ mode, project, clients, onClose, onSave }: ProjectModalProps) {
  const [form, setForm] = useState<FormState>({
    name:        project?.name ?? '',
    description: project?.description ?? '',
    clientId:    project?.clientId ?? (clients[0]?.id ?? ''),
    status:      project?.status ?? 'Pending',
    startDate:   project?.startDate ? project.startDate.substring(0, 10) : '',
    dueDate:     project?.dueDate   ? project.dueDate.substring(0, 10)   : '',
    budget:      project?.budget != null ? String(project.budget) : '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!form.name || !form.clientId) {
      setError('Completá los campos obligatorios.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const base = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        clientId:    form.clientId,
        startDate:   form.startDate || null,
        dueDate:     form.dueDate   || null,
        budget:      form.budget !== '' ? parseFloat(form.budget) : null,
      }

      if (mode === 'create') {
        await onSave(base)
      } else {
        await onSave({ ...base, status: form.status })
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        setError('El cliente seleccionado no existe.')
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
          <h2>{mode === 'create' ? 'Nuevo proyecto' : 'Editar proyecto'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Descripción (opcional)</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Cliente *</label>
            <select
              className="form-select"
              value={form.clientId}
              onChange={e => setForm({ ...form, clientId: e.target.value })}
              disabled={isSubmitting}
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {mode === 'edit' && (
            <div className="form-group">
              <label>Estado *</label>
              <select
                className="form-select"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}
                disabled={isSubmitting}
              >
                <option value="Pending">Pendiente</option>
                <option value="InProgress">En progreso</option>
                <option value="Completed">Completado</option>
                <option value="Cancelled">Cancelado</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Presupuesto (opcional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.budget}
              onChange={e => setForm({ ...form, budget: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha inicio</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label>Fecha límite</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
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
