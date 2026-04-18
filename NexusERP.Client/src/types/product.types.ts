export type Product = {
  id: string
  name: string
  description: string | null
  sku: string
  price: number
  stock: number
  minimumStock: number
  category: string
  isLowStock: boolean
  createdAt: string
  updatedAt: string
}

export type CreateProductRequest = {
  name: string
  description: string | null
  sku: string
  price: number
  stock: number
  minimumStock: number
  category: string
}

export type UpdateProductRequest = CreateProductRequest

export type ProductQueryParams = {
  page?: number
  pageSize?: number
  search?: string
  category?: string
  lowStockOnly?: boolean
}
