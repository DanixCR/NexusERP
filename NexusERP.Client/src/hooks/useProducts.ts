import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productService } from '../services/productService'
import type { CreateProductRequest, UpdateProductRequest, ProductQueryParams } from '../types/product.types'

export function useProducts(params?: ProductQueryParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => productService.getAll(params),
  })
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['products-low-stock'],
    queryFn: () => productService.getLowStock(),
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProductRequest) => productService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductRequest }) =>
      productService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => productService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] })
    },
  })
}
