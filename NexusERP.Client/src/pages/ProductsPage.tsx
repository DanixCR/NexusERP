import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts'
import type { Product, CreateProductRequest, UpdateProductRequest } from '../types/product.types'
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

// ── Tipos de estado local ────────────────────────────────────────────────────

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; product: Product }

type DeleteConfirm =
  | { open: false }
  | { open: true; product: Product }

// ── Componente principal ─────────────────────────────────────────────────────

export function ProductsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
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

  const { data, isLoading, isError } = useProducts({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    category: categoryFilter || undefined,
    lowStockOnly: lowStockOnly || undefined,
  })

  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const categories = [...new Set((data?.items ?? []).map(p => p.category))].sort()

  async function handleDelete() {
    if (!deleteConfirm.open) return
    await deleteProduct.mutateAsync(deleteConfirm.product.id)
    setDeleteConfirm({ open: false })
  }

  function formatPrice(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
        <Button onClick={() => setModal({ open: true, mode: 'create' })}>+ Nuevo producto</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter || 'all'} onValueChange={v => { setCategoryFilter(v === 'all' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={lowStockOnly ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => { setLowStockOnly(prev => !prev); setPage(1) }}
        >
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
          Stock bajo
        </Button>
      </div>

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando...</p>}
      {isError && <p className="py-6 text-center text-sm text-destructive">Error al cargar productos.</p>}

      {data && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre / SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No se encontraron productos.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">{product.sku}</div>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="text-sm">{formatPrice(product.price)}</TableCell>
                    <TableCell>
                      {product.isLowStock ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {product.stock}/{product.minimumStock}
                        </Badge>
                      ) : (
                        <span className="text-sm">{product.stock}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, mode: 'edit', product })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ open: true, product })}>
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
        <ProductModal
          mode={modal.mode}
          product={modal.mode === 'edit' ? modal.product : null}
          onClose={() => setModal({ open: false })}
          onSave={async (formData) => {
            if (modal.mode === 'create') {
              await createProduct.mutateAsync(formData as CreateProductRequest)
            } else {
              await updateProduct.mutateAsync({ id: modal.product.id, data: formData as UpdateProductRequest })
            }
            setModal({ open: false })
          }}
        />
      )}

      {deleteConfirm.open && (
        <ConfirmDialog
          message={`¿Eliminar el producto "${deleteConfirm.product.name}"? Esta acción no se puede deshacer.`}
          isLoading={deleteProduct.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ open: false })}
        />
      )}
    </div>
  )
}

// ── Modal crear / editar ─────────────────────────────────────────────────────

type ProductModalProps = {
  mode: 'create' | 'edit'
  product: Product | null
  onClose: () => void
  onSave: (data: CreateProductRequest | UpdateProductRequest) => Promise<void>
}

type FormState = {
  name: string
  description: string
  sku: string
  price: string
  stock: string
  minimumStock: string
  category: string
}

function ProductModal({ mode, product, onClose, onSave }: ProductModalProps) {
  const [form, setForm] = useState<FormState>({
    name:         product?.name         ?? '',
    description:  product?.description  ?? '',
    sku:          product?.sku          ?? '',
    price:        product?.price        != null ? String(product.price)        : '',
    stock:        product?.stock        != null ? String(product.stock)        : '',
    minimumStock: product?.minimumStock != null ? String(product.minimumStock) : '',
    category:     product?.category     ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name || !form.sku || !form.price || form.stock === '' || form.minimumStock === '' || !form.category) {
      setError('Completá todos los campos obligatorios.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave({
        name:         form.name.trim(),
        description:  form.description.trim() || null,
        sku:          form.sku.trim(),
        price:        parseFloat(form.price),
        stock:        parseInt(form.stock, 10),
        minimumStock: parseInt(form.minimumStock, 10),
        category:     form.category.trim(),
      })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 409 ? 'Ya existe un producto con ese SKU.' : 'Error inesperado. Intentá de nuevo.')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={isSubmitting} />
          </div>

          <div className="grid gap-1.5">
            <Label>Descripción (opcional)</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} disabled={isSubmitting} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>SKU *</Label>
              <Input
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                disabled={isSubmitting}
                className="uppercase"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Categoría *</Label>
              <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} disabled={isSubmitting} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Precio *</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} disabled={isSubmitting} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Stock actual *</Label>
              <Input type="number" min="0" step="1" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} disabled={isSubmitting} />
            </div>
            <div className="grid gap-1.5">
              <Label>Stock mínimo *</Label>
              <Input type="number" min="0" step="1" value={form.minimumStock} onChange={e => setForm({ ...form, minimumStock: e.target.value })} disabled={isSubmitting} />
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
