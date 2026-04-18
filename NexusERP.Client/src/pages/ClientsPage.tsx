import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../hooks/useClients'
import type { Client, CreateClientRequest } from '../types/client.types'

// ── Tipos de estado local ────────────────────────────────────────────────────

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; client: Client }

type DeleteConfirm =
  | { open: false }
  | { open: true; client: Client }

const EMPTY_FORM: CreateClientRequest = {
  name: '',
  email: '',
  phone: '',
  taxId: '',
  address: null,
}

// ── Componente principal ─────────────────────────────────────────────────────

export function ClientsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm>({ open: false })

  // Debounce: espera 300ms después del último keypress para actualizar la búsqueda real
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)  // volver a la página 1 al cambiar el filtro
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, isError } = useClients({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  })

  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()

  function openCreate() {
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(client: Client) {
    setModal({ open: true, mode: 'edit', client })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function openDeleteConfirm(client: Client) {
    setDeleteConfirm({ open: true, client })
  }

  function closeDeleteConfirm() {
    setDeleteConfirm({ open: false })
  }

  async function handleDelete() {
    if (!deleteConfirm.open) return
    await deleteClient.mutateAsync(deleteConfirm.client.id)
    closeDeleteConfirm()
  }

  return (
    <div className="page-container">
      {/* Cabecera */}
      <div className="page-header">
        <h1>Clientes</h1>
        <button className="btn-primary" onClick={openCreate}>
          + Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por nombre, email o RUC..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabla */}
      {isLoading && <p className="state-message">Cargando...</p>}
      {isError && <p className="state-message error">Error al cargar clientes.</p>}

      {data && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>RUC / Tax ID</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      No se encontraron clientes.
                    </td>
                  </tr>
                )}
                {data.items.map(client => (
                  <tr key={client.id}>
                    <td>{client.name}</td>
                    <td>{client.email}</td>
                    <td>{client.phone}</td>
                    <td>{client.taxId}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon"
                        title="Editar"
                        onClick={() => openEdit(client)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        title="Eliminar"
                        onClick={() => openDeleteConfirm(client)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {data.totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ←
              </button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={p === page ? 'active' : ''}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === data.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal crear / editar */}
      {modal.open && (
        <ClientModal
          mode={modal.mode}
          client={modal.mode === 'edit' ? modal.client : null}
          onClose={closeModal}
          onSave={async (formData) => {
            if (modal.mode === 'create') {
              await createClient.mutateAsync(formData)
            } else {
              await updateClient.mutateAsync({ id: modal.client.id, data: formData })
            }
            closeModal()
          }}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      {deleteConfirm.open && (
        <ConfirmDialog
          message={`¿Eliminar a "${deleteConfirm.client.name}"? Esta acción no se puede deshacer.`}
          isLoading={deleteClient.isPending}
          onConfirm={handleDelete}
          onCancel={closeDeleteConfirm}
        />
      )}
    </div>
  )
}

// ── Modal crear / editar ─────────────────────────────────────────────────────

type ClientModalProps = {
  mode: 'create' | 'edit'
  client: Client | null
  onClose: () => void
  onSave: (data: CreateClientRequest) => Promise<void>
}

function ClientModal({ mode, client, onClose, onSave }: ClientModalProps) {
  const [form, setForm] = useState<CreateClientRequest>(
    client
      ? { name: client.name, email: client.email, phone: client.phone, taxId: client.taxId, address: client.address }
      : EMPTY_FORM
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!form.name || !form.email || !form.phone || !form.taxId) {
      setError('Completá los campos obligatorios.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSave(form)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        setError('Ya existe un cliente con ese RUC / Tax ID.')
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
          <h2>{mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h2>
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
            <label>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Teléfono *</label>
            <input
              type="text"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>RUC / Identificador fiscal *</label>
            <input
              type="text"
              value={form.taxId}
              onChange={e => setForm({ ...form, taxId: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Dirección (opcional)</label>
            <input
              type="text"
              value={form.address ?? ''}
              onChange={e => setForm({ ...form, address: e.target.value || null })}
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
          <button className="btn-secondary" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
