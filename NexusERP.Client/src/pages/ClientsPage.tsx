import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../hooks/useClients'
import type { Client, CreateClientRequest } from '../types/client.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
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

  function openCreate() { setModal({ open: true, mode: 'create' }) }
  function openEdit(client: Client) { setModal({ open: true, mode: 'edit', client }) }
  function closeModal() { setModal({ open: false }) }
  function openDeleteConfirm(client: Client) { setDeleteConfirm({ open: true, client }) }
  function closeDeleteConfirm() { setDeleteConfirm({ open: false }) }

  async function handleDelete() {
    if (!deleteConfirm.open) return
    await deleteClient.mutateAsync(deleteConfirm.client.id)
    closeDeleteConfirm()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <Button onClick={openCreate}>+ Nuevo cliente</Button>
      </div>

      <Input
        placeholder="Buscar por nombre, email o RUC..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando...</p>}
      {isError && <p className="py-6 text-center text-sm text-destructive">Error al cargar clientes.</p>}

      {data && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>RUC / Tax ID</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No se encontraron clientes.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map(client => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>{client.taxId}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteConfirm(client)}>
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
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>→</Button>
            </div>
          )}
        </>
      )}

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
      : EMPTY_FORM,
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
      setError(status === 409 ? 'Ya existe un cliente con ese RUC / Tax ID.' : 'Error inesperado. Intentá de nuevo.')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={isSubmitting} />
          </div>
          <div className="grid gap-1.5">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={isSubmitting} />
          </div>
          <div className="grid gap-1.5">
            <Label>Teléfono *</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} disabled={isSubmitting} />
          </div>
          <div className="grid gap-1.5">
            <Label>RUC / Identificador fiscal *</Label>
            <Input value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} disabled={isSubmitting} />
          </div>
          <div className="grid gap-1.5">
            <Label>Dirección (opcional)</Label>
            <Input value={form.address ?? ''} onChange={e => setForm({ ...form, address: e.target.value || null })} disabled={isSubmitting} />
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
