import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useProjects, useAllClients, useCreateProject, useUpdateProject, useDeleteProject } from '../hooks/useProjects'
import type { Project, ProjectStatus, CreateProjectRequest, UpdateProjectRequest } from '../types/project.types'
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

// ── Indicador visual de estado ───────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  Pending:    { label: 'Pendiente',    className: 'border-zinc-300 text-zinc-600 bg-zinc-50' },
  InProgress: { label: 'En progreso', className: 'border-blue-300 text-blue-700 bg-blue-50' },
  Completed:  { label: 'Completado',  className: 'border-green-300 text-green-700 bg-green-50' },
  Cancelled:  { label: 'Cancelado',   className: 'border-red-300 text-red-600 bg-red-50' },
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = STATUS_CONFIG[status]
  return <Badge variant="outline" className={className}>{label}</Badge>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
        <Button onClick={() => setModal({ open: true, mode: 'create' })}>+ Nuevo proyecto</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nombre o descripción..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter || 'all'} onValueChange={v => { setStatusFilter(v === 'all' ? '' : (v ?? '') as ProjectStatus); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="Pending">Pendiente</SelectItem>
            <SelectItem value="InProgress">En progreso</SelectItem>
            <SelectItem value="Completed">Completado</SelectItem>
            <SelectItem value="Cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter || 'all'} onValueChange={v => { setClientFilter(v === 'all' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clientsData?.items.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando...</p>}
      {isError && <p className="py-6 text-center text-sm text-destructive">Error al cargar proyectos.</p>}

      {data && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No se encontraron proyectos.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map(project => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="font-medium">{project.name}</div>
                      {project.description && (
                        <div className="max-w-[280px] truncate text-sm text-muted-foreground">{project.description}</div>
                      )}
                    </TableCell>
                    <TableCell>{project.clientName}</TableCell>
                    <TableCell><StatusBadge status={project.status} /></TableCell>
                    <TableCell className="text-sm">{formatDate(project.startDate)}</TableCell>
                    <TableCell className="text-sm">{formatDate(project.dueDate)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, mode: 'edit', project })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ open: true, project })}>
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
  budget: string
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
      await onSave(mode === 'create' ? base : { ...base, status: form.status })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 404 ? 'El cliente seleccionado no existe.' : 'Error inesperado. Intentá de nuevo.')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuevo proyecto' : 'Editar proyecto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={isSubmitting} />
          </div>

          <div className="grid gap-1.5">
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v ?? '' })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {mode === 'edit' && project && !clients.some(c => c.id === project.clientId) && (
                  <SelectItem value={project.clientId}>{project.clientName}</SelectItem>
                )}
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'edit' && (
            <div className="grid gap-1.5">
              <Label>Estado *</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: (v ?? form.status) as ProjectStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pendiente</SelectItem>
                  <SelectItem value="InProgress">En progreso</SelectItem>
                  <SelectItem value="Completed">Completado</SelectItem>
                  <SelectItem value="Cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Presupuesto (opcional)</Label>
            <Input
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.budget}
              onChange={e => setForm({ ...form, budget: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Fecha inicio</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} disabled={isSubmitting} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha límite</Label>
              <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} disabled={isSubmitting} />
            </div>
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
