import { apiClient } from '../lib/axios'
import type { Product, CreateProductRequest, UpdateProductRequest, ProductQueryParams } from '../types/product.types'
import type { PagedResponse } from '../types/client.types'

export const productService = {
  getAll(params?: ProductQueryParams): Promise<PagedResponse<Product>> {
    return apiClient.get<PagedResponse<Product>>('/products', { params }).then(r => r.data)
  },

  getLowStock(): Promise<Product[]> {
    return apiClient.get<Product[]>('/products/low-stock').then(r => r.data)
  },

  getById(id: string): Promise<Product> {
    return apiClient.get<Product>(`/products/${id}`).then(r => r.data)
  },

  create(data: CreateProductRequest): Promise<Product> {
    return apiClient.post<Product>('/products', data).then(r => r.data)
  },

  update(id: string, data: UpdateProductRequest): Promise<Product> {
    return apiClient.put<Product>(`/products/${id}`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/products/${id}`).then(() => undefined)
  },
}
