import { useState } from 'react'
import { useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket, useChangeTicketStatus } from '../hooks/useTickets'
import { useAllClients, useAllEmployees } from '../hooks/useProjects'
import type { Ticket, TicketPriority, TicketStatus, CreateTicketRequest } from '../types/ticket.types'

type ModalMode = 'create' | 'edit'
type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; ticket: Ticket }

type DeleteConfirm = { open: false } | { open: true; ticket: Ticket }

type FormState = {
  title: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  category: string
  clientId: string
  assignedEmployeeId: string
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; className: string }> = {
  Open:       { label: 'Abierto',     className: 'badge-blue'   },
  InProgress: { label: 'En progreso', className: 'badge-purple' },
  Resolved:   { label: 'Resuelto',    className: 'badge-green'  },
  Closed:     { label: 'Cerrado',     className: 'badge-gray'   },
}

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; className: string }> = {
  Low:      { label: 'Baja',    className: 'badge-green'  },
  Medium:   { label: 'Media',   className: 'badge-yellow' },
  High:     { label: 'Alta',    className: 'badge-orange' },
  Critical: { label: 'Crítica', className: 'badge-red'    },
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status]
  return <span className={`status-badge ${cfg.className}`}>{cfg.label}</span>
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return <span className={`status-badge ${cfg.className}`}>{cfg.label}</span>
}

const BLANK_FORM: FormState = {
  title: '',
  description: '',
  priority: 'Medium',
  status: 'Open',
  category: '',
  clientId: '',
  assignedEmployeeId: '',
}

function toFormState(t: Ticket): FormState {
  return {
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    category: t.category,
    clientId: t.clientId ?? '',
    assignedEmployeeId: t.assignedEmployeeId ?? '',
  }
}

export function TicketsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm>({ open: false })
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const { data, isLoading, isError } = useTickets({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  })

  const { data: clientsData } = useAllClients()
  const { data: employeesData } = useAllEmployees()
  const createMutation = useCreateTicket()
  const updateMutation = useUpdateTicket()
  const deleteMutation = useDeleteTicket()
  const changeStatusMutation = useChangeTicketStatus()

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimer) clearTimeout(searchTimer)
    const t = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)
    setSearchTimer(t)
  }

  function openCreate() {
    setForm(BLANK_FORM)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(ticket: Ticket) {
    setForm(toFormState(ticket))
    setModal({ open: true, mode: 'edit', ticket })
  }

  function closeModal() {
    setModal({ open: false })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!modal.open) return

    const payload: CreateTicketRequest = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      category: form.category,
      clientId: form.clientId || null,
      assignedEmployeeId: form.assignedEmployeeId || null,
    }

    if (modal.mode === 'create') {
      await createMutation.mutateAsync(payload)
    } else {
      await updateMutation.mutateAsync({ id: modal.ticket.id, data: payload })
      if (form.status !== modal.ticket.status) {
        await changeStatusMutation.mutateAsync({
          id: modal.ticket.id,
          data: { status: form.status },
        })
      }
    }
    closeModal()
  }

  async function handleDelete() {
    if (!deleteConfirm.open) return
    await deleteMutation.mutateAsync(deleteConfirm.ticket.id)
    setDeleteConfirm({ open: false })
  }

  const totalPages = data?.totalPages ?? 1
  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    changeStatusMutation.isPending

  const modalMode: ModalMode = modal.open ? modal.mode : 'create'

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Tickets</h1>
        <button className="btn-primary" onClick={openCreate}>
          + Nuevo ticket
        </button>
      </div>

      <div className="filters-bar">
        <input
          className="filter-search"
          placeholder="Buscar por título..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as TicketStatus | ''); setPage(1) }}
        >
          <option value="">Todos los estados</option>
          {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value as TicketPriority | ''); setPage(1) }}
        >
          <option value="">Todas las prioridades</option>
          {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map(p => (
            <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="state-message">Cargando tickets...</div>}
      {isError && <div className="state-message error">Error al cargar los tickets.</div>}

      {!isLoading && !isError && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Categoría</th>
                  <th>Cliente</th>
                  <th>Asignado a</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-row">No hay tickets registrados.</td>
                  </tr>
                )}
                {data?.items.map(ticket => (
                  <tr key={ticket.id}>
                    <td>
                      <div className="cell-primary">{ticket.title}</div>
                      <div className="cell-secondary">{ticket.description}</div>
                    </td>
                    <td><StatusBadge status={ticket.status} /></td>
                    <td><PriorityBadge priority={ticket.priority} /></td>
                    <td>{ticket.category}</td>
                    <td>{ticket.clientName ?? <span style={{ color: 'var(--text)' }}>—</span>}</td>
                    <td>{ticket.assignedEmployeeName ?? <span style={{ color: 'var(--text)' }}>—</span>}</td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-icon" title="Editar" onClick={() => openEdit(ticket)}>✏️</button>
                        <button className="btn-icon" title="Eliminar" onClick={() => setDeleteConfirm({ open: true, ticket })}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>←</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={p === page ? 'active' : ''}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>→</button>
            </div>
          )}
        </>
      )}

      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Nuevo ticket' : 'Editar ticket'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Título *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  disabled={isPending}
                />
              </div>

              <div className="form-group">
                <label>Descripción *</label>
                <textarea
                  className="form-textarea"
                  required
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  disabled={isPending}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Categoría *</label>
                  <input
                    required
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    disabled={isPending}
                  />
                </div>
                <div className="form-group">
                  <label>Prioridad *</label>
                  <select
                    className="form-select"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}
                    disabled={isPending}
                  >
                    {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map(p => (
                      <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {modalMode === 'edit' && (
                <div className="form-group">
                  <label>Estado *</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as TicketStatus }))}
                    disabled={isPending}
                  >
                    {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Cliente (opcional)</label>
                <select
                  className="form-select"
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  disabled={isPending}
                >
                  <option value="">Sin asignar</option>
                  {clientsData?.items.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Empleado asignado (opcional)</label>
                <select
                  className="form-select"
                  value={form.assignedEmployeeId}
                  onChange={e => setForm(f => ({ ...f, assignedEmployeeId: e.target.value }))}
                  disabled={isPending}
                >
                  <option value="">Sin asignar</option>
                  {employeesData?.items.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={isPending}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={isPending}>
                  {isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm.open && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm({ open: false })}>
          <div className="modal-card confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Eliminar ticket</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm({ open: false })}>✕</button>
            </div>
            <p>
              ¿Eliminar el ticket <strong>{deleteConfirm.ticket.title}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteConfirm({ open: false })} disabled={isPending}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={handleDelete} disabled={isPending}>
                {isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
