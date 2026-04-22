import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts'
import type { Product, CreateProductRequest, UpdateProductRequest } from '../types/product.types'

// ── Stock cell ───────────────────────────────────────────────────────────────

function StockCell({ stock, minimumStock, isLowStock }: { stock: number; minimumStock: number; isLowStock: boolean }) {
  if (!isLowStock) return <span>{stock}</span>
  return <span className="stock-low">⚠ {stock}/{minimumStock}</span>
}

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
  const navigate = useNavigate()
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

  function handleCategoryChange(value: string) {
    setCategoryFilter(value)
    setPage(1)
  }

  function handleLowStockToggle() {
    setLowStockOnly(prev => !prev)
    setPage(1)
  }

  async function handleDelete() {
    if (!deleteConfirm.open) return
    await deleteProduct.mutateAsync(deleteConfirm.product.id)
    setDeleteConfirm({ open: false })
  }

  function formatPrice(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  return (
    <div className="page-container">
      {/* Cabecera */}
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>← Volver al dashboard</button>
        <h1>Inventario</h1>
        <button className="btn-primary" onClick={() => setModal({ open: true, mode: 'create' })}>
          + Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={categoryFilter}
          onChange={e => handleCategoryChange(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button
          className={lowStockOnly ? 'btn-filter-active' : 'btn-filter'}
          onClick={handleLowStockToggle}
        >
          ⚠ Stock bajo
        </button>
      </div>

      {/* Tabla */}
      {isLoading && <p className="state-message">Cargando...</p>}
      {isError && <p className="state-message error">Error al cargar productos.</p>}

      {data && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre / SKU</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      No se encontraron productos.
                    </td>
                  </tr>
                )}
                {data.items.map(product => (
                  <tr key={product.id}>
                    <td>
                      <div className="cell-primary">{product.name}</div>
                      <div className="cell-secondary">{product.sku}</div>
                    </td>
                    <td>{product.category}</td>
                    <td>{formatPrice(product.price)}</td>
                    <td>
                      <StockCell
                        stock={product.stock}
                        minimumStock={product.minimumStock}
                        isLowStock={product.isLowStock}
                      />
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon"
                        title="Editar"
                        onClick={() => setModal({ open: true, mode: 'edit', product })}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        title="Eliminar"
                        onClick={() => setDeleteConfirm({ open: true, product })}
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

      {/* Confirmación de eliminación */}
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
      if (status === 409) {
        setError('Ya existe un producto con ese SKU.')
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
          <h2>{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2>
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

          <div className="form-row">
            <div className="form-group">
              <label>SKU *</label>
              <input
                type="text"
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                disabled={isSubmitting}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group">
              <label>Categoría *</label>
              <input
                type="text"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Precio *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Stock actual *</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={e => setForm({ ...form, stock: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label>Stock mínimo *</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.minimumStock}
                onChange={e => setForm({ ...form, minimumStock: e.target.value })}
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
