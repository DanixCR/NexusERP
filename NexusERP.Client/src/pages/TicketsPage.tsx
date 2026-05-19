import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket, useChangeTicketStatus } from '../hooks/useTickets'
import { useAllClients, useAllEmployees } from '../hooks/useProjects'
import type { Ticket, TicketPriority, TicketStatus, CreateTicketRequest } from '../types/ticket.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Config de badges ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TicketStatus, { label: string; className: string }> = {
  Open:       { label: 'Abierto',     className: 'border-blue-300 text-blue-700 bg-blue-50' },
  InProgress: { label: 'En progreso', className: 'border-purple-300 text-purple-700 bg-purple-50' },
  Resolved:   { label: 'Resuelto',    className: 'border-green-300 text-green-700 bg-green-50' },
  Closed:     { label: 'Cerrado',     className: 'border-zinc-300 text-zinc-600 bg-zinc-50' },
}

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; className: string }> = {
  Low:      { label: 'Baja',    className: 'border-zinc-300 text-zinc-500 bg-zinc-50' },
  Medium:   { label: 'Media',   className: 'border-yellow-300 text-yellow-700 bg-yellow-50' },
  High:     { label: 'Alta',    className: 'border-orange-300 text-orange-700 bg-orange-50' },
  Critical: { label: 'Crítica', className: 'border-red-300 text-red-700 bg-red-50' },
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status]
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

// ── Tipos de estado local ────────────────────────────────────────────────────

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

const BLANK_FORM: FormState = {
  title: '', description: '', priority: 'Medium',
  status: 'Open', category: '', clientId: '', assignedEmployeeId: '',
}

function toFormState(t: Ticket): FormState {
  return {
    title: t.title, description: t.description, priority: t.priority,
    status: t.status, category: t.category,
    clientId: t.clientId ?? '', assignedEmployeeId: t.assignedEmployeeId ?? '',
  }
}

// ── Componente principal ─────────────────────────────────────────────────────

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
    const t = setTimeout(() => { setDebouncedSearch(value); setPage(1) }, 300)
    setSearchTimer(t)
  }

  function openCreate() { setForm(BLANK_FORM); setModal({ open: true, mode: 'create' }) }
  function openEdit(ticket: Ticket) { setForm(toFormState(ticket)); setModal({ open: true, mode: 'edit', ticket }) }
  function closeModal() { setModal({ open: false }) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!modal.open) return

    const payload: CreateTicketRequest = {
      title: form.title, description: form.description,
      priority: form.priority, category: form.category,
      clientId: form.clientId || null,
      assignedEmployeeId: form.assignedEmployeeId || null,
    }

    if (modal.mode === 'create') {
      await createMutation.mutateAsync(payload)
    } else {
      await updateMutation.mutateAsync({ id: modal.ticket.id, data: payload })
      if (form.status !== modal.ticket.status) {
        await changeStatusMutation.mutateAsync({ id: modal.ticket.id, data: { status: form.status } })
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
  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || changeStatusMutation.isPending
  const modalMode = modal.open ? modal.mode : 'create'
  const editingTicket = modal.open && modal.mode === 'edit' ? modal.ticket : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
        <Button onClick={openCreate}>+ Nuevo ticket</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por título..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter || 'all'} onValueChange={v => { setStatusFilter(v === 'all' ? '' : (v ?? '') as TicketStatus); setPage(1) }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter || 'all'} onValueChange={v => { setPriorityFilter(v === 'all' ? '' : (v ?? '') as TicketPriority); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas las prioridades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map(p => (
              <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando tickets...</p>}
      {isError && <p className="py-6 text-center text-sm text-destructive">Error al cargar los tickets.</p>}

      {!isLoading && !isError && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No hay tickets registrados.</TableCell>
                  </TableRow>
                )}
                {data?.items.map(ticket => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div className="font-medium">{ticket.title}</div>
                      <div className="max-w-[240px] truncate text-sm text-muted-foreground">{ticket.description}</div>
                    </TableCell>
                    <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                    <TableCell className="text-sm">{ticket.category}</TableCell>
                    <TableCell className="text-sm">{ticket.clientName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{ticket.assignedEmployeeName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(ticket)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ open: true, ticket })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>←</Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)}>{p}</Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>→</Button>
            </div>
          )}
        </>
      )}

      {/* Modal crear / editar */}
      {modal.open && (
        <Dialog open onOpenChange={(open) => { if (!open) closeModal() }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{modalMode === 'create' ? 'Nuevo ticket' : 'Editar ticket'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-1.5">
                <Label>Título *</Label>
                <Input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} disabled={isPending} />
              </div>

              <div className="grid gap-1.5">
                <Label>Descripción *</Label>
                <Textarea required rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} disabled={isPending} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Categoría *</Label>
                  <Input required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} disabled={isPending} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Prioridad *</Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: (v ?? f.priority) as TicketPriority }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map(p => (
                        <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {modalMode === 'edit' && (
                <div className="grid gap-1.5">
                  <Label>Estado *</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as TicketStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map(s => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label>Cliente (opcional)</Label>
                <Select
                  value={form.clientId || 'none'}
                  onValueChange={v => setForm(f => ({ ...f, clientId: v === 'none' ? '' : (v ?? '') }))}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {editingTicket?.clientId && !clientsData?.items?.some(c => c.id === editingTicket.clientId) && (
                      <SelectItem value={editingTicket.clientId}>{editingTicket.clientName ?? editingTicket.clientId}</SelectItem>
                    )}
                    {clientsData?.items?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Empleado asignado (opcional)</Label>
                <Select
                  value={form.assignedEmployeeId || 'none'}
                  onValueChange={v => setForm(f => ({ ...f, assignedEmployeeId: v === 'none' ? '' : (v ?? '') }))}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {editingTicket?.assignedEmployeeId && !employeesData?.items?.some(e => e.id === editingTicket.assignedEmployeeId) && (
                      <SelectItem value={editingTicket.assignedEmployeeId}>{editingTicket.assignedEmployeeName ?? editingTicket.assignedEmployeeId}</SelectItem>
                    )}
                    {employeesData?.items?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal} disabled={isPending}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmación de eliminación */}
      {deleteConfirm.open && (
        <Dialog open onOpenChange={(open) => { if (!open) setDeleteConfirm({ open: false }) }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar ticket</DialogTitle>
              <DialogDescription>
                ¿Eliminar el ticket <strong>{deleteConfirm.ticket.title}</strong>? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm({ open: false })} disabled={isPending}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                {isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
