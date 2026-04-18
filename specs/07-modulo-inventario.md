# Spec 07 — Módulo de Inventario

**Estado:** Pendiente de validación  
**Alcance:** Backend (`NexusERP.Core`, `NexusERP.Infrastructure`, `NexusERP.API`) + Frontend (`NexusERP.Client/src/`)  
**Prerequisito:** Spec 06 ejecutada (patrón de módulo autónomo establecido; `ConflictException` disponible)

---

## Visión general

Un producto representa un artículo que la empresa vende, compra o almacena. Este módulo introduce el concepto de **lógica de dominio calculada**: la propiedad `IsLowStock` no se persiste en la base de datos — se calcula en tiempo real comparando `Stock < MinimumStock`. También introduce el patrón de **filtro booleano** en query params para exponer solo los productos con alerta de stock.

```
Product
  ├── Name, Description, SKU (único)
  ├── Price (precio unitario)
  ├── Stock (cantidad actual), MinimumStock (umbral de alerta)
  ├── Category (categoría libre)
  ├── IsLowStock → calculado: Stock < MinimumStock  [no se persiste]
  └── IsActive (soft delete)
```

`Product` no tiene relaciones con otras entidades en esta spec — es una entidad raíz autónoma.

---

## Parte 1 — Backend

### Archivos a crear

```
NexusERP.Core/
├── Entities/
│   └── Product.cs
├── Interfaces/
│   └── IProductRepository.cs
├── DTOs/
│   └── Products/
│       ├── CreateProductDto.cs
│       ├── UpdateProductDto.cs
│       ├── ProductResponseDto.cs
│       └── ProductQueryParams.cs
└── Services/
    └── ProductService.cs

NexusERP.Infrastructure/
└── Repositories/
    └── ProductRepository.cs

NexusERP.API/
└── Controllers/
    └── ProductsController.cs
```

### Archivos a modificar

```
NexusERP.Infrastructure/Data/AppDbContext.cs   ← agregar DbSet<Product> + configuración
NexusERP.API/Program.cs                        ← registrar IProductRepository + ProductService
```

---

### 1. Entidad `Product` (`NexusERP.Core/Entities/Product.cs`)

```csharp
namespace NexusERP.Core.Entities;

public class Product
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SKU { get; set; } = string.Empty;       // Stock Keeping Unit — código único del producto
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public int MinimumStock { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Propiedad calculada — no se persiste en la base de datos
    public bool IsLowStock => Stock < MinimumStock;
}
```

**¿Qué es un SKU y por qué es `string` y no `int`?**  
SKU (Stock Keeping Unit) es el identificador de negocio de un producto — el código que el equipo de ventas, bodega y proveedores usan en la práctica. A diferencia del `Id` (Guid interno), el SKU tiene que ser legible: `"ELEC-001"`, `"CAMIS-M-AZUL"`, `"A4-RESMA"`. Un `int` no permitiría ese formato libre, y sería difícil de usar en un lector de código de barras o en un sistema externo.

**¿Por qué `Stock` y `MinimumStock` son `int` y no `decimal`?**  
La mayoría de los inventarios miden unidades enteras — no tiene sentido tener 2.5 sillas o 0.3 laptops. `int` refleja esa realidad y evita errores de redondeo. Si el negocio vendiera productos a granel (kg, litros), se cambiaría a `decimal` en ese momento, no antes.

**¿Por qué `IsLowStock` es una propiedad calculada en la entidad y no en el DTO?**  
`IsLowStock` es lógica de dominio puro: "un producto tiene stock bajo cuando su cantidad actual es menor al mínimo". Pertenece a la entidad, en `Core`, no al DTO de presentación. Ponerlo en la entidad significa que cualquier parte del sistema que tenga acceso a un `Product` puede saber si tiene stock bajo sin depender del DTO. EF Core ignora automáticamente las propiedades sin setter al mapear — no se necesita ninguna anotación especial.

**¿Por qué `MinimumStock` puede ser `0`?**  
Un producto con `MinimumStock = 0` nunca dispara alerta — útil para artículos que se piden bajo demanda y no necesitan stock mínimo. El valor `0` es el default natural para "sin alerta configurada".

---

### 2. Interfaz `IProductRepository` (`NexusERP.Core/Interfaces/IProductRepository.cs`)

```csharp
using NexusERP.Core.DTOs.Products;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id);
    Task<Product?> GetBySkuAsync(string sku);
    Task<(IEnumerable<Product> Items, int TotalCount)> GetPagedAsync(ProductQueryParams query);
    Task<IEnumerable<Product>> GetLowStockAsync();
    Task CreateAsync(Product product);
    Task UpdateAsync(Product product);
    Task DeleteAsync(Product product);
}
```

**¿Por qué `GetLowStockAsync` devuelve `IEnumerable<Product>` sin paginación?**  
Los productos con stock bajo son una lista de alerta — el usuario quiere verlos todos de un vistazo, no paginarlos. Si la empresa tiene 500 productos y 12 con stock bajo, paginar esos 12 sería molesto. En el peor caso si hubiera cientos de alertas, la paginación se agregaría entonces. `GetLowStockAsync` también sirve para un futuro widget del dashboard que muestre el conteo.

---

### 3. DTOs (`NexusERP.Core/DTOs/Products/`)

#### `CreateProductDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Products;

public class CreateProductDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SKU { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public int MinimumStock { get; set; }
    public string Category { get; set; } = string.Empty;
}
```

#### `UpdateProductDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Products;

public class UpdateProductDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SKU { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public int MinimumStock { get; set; }
    public string Category { get; set; } = string.Empty;
}
```

#### `ProductResponseDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Products;

public class ProductResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SKU { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public int MinimumStock { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool IsLowStock { get; set; }   // Copiado de la propiedad calculada de la entidad
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**¿Por qué `IsLowStock` se incluye en el DTO de respuesta si ya se puede calcular en el frontend?**  
El frontend no debería recalcular lógica de negocio. Si mañana la regla cambia a `Stock <= MinimumStock` o a `Stock < MinimumStock * 1.2` (20% de margen), el cambio se hace en un solo lugar: la entidad `Product`. Si el frontend lo recalcula, habría que cambiarlo también allá. El DTO simplemente expone lo que ya calculó el dominio.

#### `ProductQueryParams.cs`

```csharp
namespace NexusERP.Core.DTOs.Products;

public class ProductQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }       // Filtra por nombre o SKU
    public string? Category { get; set; }     // Filtra por categoría exacta
    public bool LowStockOnly { get; set; }    // Si true, devuelve solo productos con stock bajo
}
```

**¿Por qué `LowStockOnly` es `bool` y no `string?`?**  
A diferencia de `Status` en proyectos (que era un enum con múltiples valores posibles), `LowStockOnly` es binario: activo o inactivo. Un `bool` con default `false` significa que por defecto se devuelven todos los productos. ASP.NET Core parsea `?lowStockOnly=true` a `bool` automáticamente.

---

### 4. Servicio `ProductService` (`NexusERP.Core/Services/ProductService.cs`)

```csharp
using NexusERP.Core.DTOs.Products;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class ProductService
{
    private readonly IProductRepository _productRepository;

    public ProductService(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<(IEnumerable<ProductResponseDto> Items, int TotalCount)> GetPagedAsync(ProductQueryParams query)
    {
        var (items, total) = await _productRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<IEnumerable<ProductResponseDto>> GetLowStockAsync()
    {
        var products = await _productRepository.GetLowStockAsync();
        return products.Select(MapToDto);
    }

    public async Task<ProductResponseDto> GetByIdAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Product {id} not found");

        return MapToDto(product);
    }

    public async Task<ProductResponseDto> CreateAsync(CreateProductDto dto)
    {
        var existing = await _productRepository.GetBySkuAsync(dto.SKU.Trim().ToUpper());
        if (existing is not null)
            throw new ConflictException($"A product with SKU '{dto.SKU}' already exists");

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            SKU = dto.SKU.Trim().ToUpper(),
            Price = dto.Price,
            Stock = dto.Stock,
            MinimumStock = dto.MinimumStock,
            Category = dto.Category.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _productRepository.CreateAsync(product);
        return MapToDto(product);
    }

    public async Task<ProductResponseDto> UpdateAsync(Guid id, UpdateProductDto dto)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Product {id} not found");

        var normalizedSku = dto.SKU.Trim().ToUpper();
        if (product.SKU != normalizedSku)
        {
            var existing = await _productRepository.GetBySkuAsync(normalizedSku);
            if (existing is not null)
                throw new ConflictException($"A product with SKU '{dto.SKU}' already exists");
        }

        product.Name = dto.Name.Trim();
        product.Description = dto.Description?.Trim();
        product.SKU = normalizedSku;
        product.Price = dto.Price;
        product.Stock = dto.Stock;
        product.MinimumStock = dto.MinimumStock;
        product.Category = dto.Category.Trim();
        product.UpdatedAt = DateTime.UtcNow;

        await _productRepository.UpdateAsync(product);
        return MapToDto(product);
    }

    public async Task DeleteAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Product {id} not found");

        await _productRepository.DeleteAsync(product);
    }

    private static ProductResponseDto MapToDto(Product p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        SKU = p.SKU,
        Price = p.Price,
        Stock = p.Stock,
        MinimumStock = p.MinimumStock,
        Category = p.Category,
        IsLowStock = p.IsLowStock,    // Propiedad calculada de la entidad
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}
```

**¿Por qué el SKU se normaliza a mayúsculas (`ToUpper`)?**  
Los SKUs son códigos de identificación que se comparten entre sistemas, etiquetas y comunicaciones con proveedores. La convención universal es mayúsculas: `"ELEC-001"`, no `"elec-001"`. Normalizar al guardar garantiza que `"elec-001"` y `"ELEC-001"` se traten como el mismo SKU, evitando duplicados por diferencia de casing.

---

### 5. Repositorio `ProductRepository` (`NexusERP.Infrastructure/Repositories/ProductRepository.cs`)

```csharp
using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Products;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly AppDbContext _context;

    public ProductRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Product?> GetByIdAsync(Guid id)
        => await _context.Products
            .Where(p => p.IsActive)
            .FirstOrDefaultAsync(p => p.Id == id);

    public async Task<Product?> GetBySkuAsync(string sku)
        => await _context.Products
            .Where(p => p.IsActive)
            .FirstOrDefaultAsync(p => p.SKU == sku);

    public async Task<(IEnumerable<Product> Items, int TotalCount)> GetPagedAsync(ProductQueryParams query)
    {
        var q = _context.Products.Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(p =>
                p.Name.ToLower().Contains(search) ||
                p.SKU.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim().ToLower();
            q = q.Where(p => p.Category.ToLower() == category);
        }

        if (query.LowStockOnly)
        {
            q = q.Where(p => p.Stock < p.MinimumStock);
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderBy(p => p.Name)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<IEnumerable<Product>> GetLowStockAsync()
        => await _context.Products
            .Where(p => p.IsActive && p.Stock < p.MinimumStock)
            .OrderBy(p => p.Stock)   // Los más críticos (stock más bajo) primero
            .ToListAsync();

    public async Task CreateAsync(Product product)
    {
        await _context.Products.AddAsync(product);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Product product)
    {
        _context.Products.Update(product);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Product product)
    {
        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
```

**¿Cómo puede EF Core evaluar `p.Stock < p.MinimumStock` en SQL si `IsLowStock` es una propiedad calculada en C#?**  
EF Core traduce las expresiones lambda de LINQ a SQL. `p.Stock < p.MinimumStock` es una comparación de dos columnas de la misma fila — EF Core genera `WHERE [Stock] < [MinimumStock]` perfectamente. Lo que EF Core no puede traducir son los métodos de C# complejos o propiedades calculadas que hacen cosas fuera de la base de datos. En este caso, la comparación es directamente traducible.

**¿Por qué `GetLowStockAsync` ordena por `Stock` ascendente?**  
Los productos con menos stock son los más urgentes. Mostrarlos primero permite al encargado de inventario saber de un vistazo cuáles necesitan reposición inmediata.

---

### 6. Modificar `AppDbContext`

```csharp
// Nueva propiedad:
public DbSet<Product> Products => Set<Product>();

// En OnModelCreating, agregar:
modelBuilder.Entity<Product>(entity =>
{
    entity.HasKey(p => p.Id);
    entity.Property(p => p.Id).ValueGeneratedNever();
    entity.Property(p => p.Name).HasMaxLength(300).IsRequired();
    entity.Property(p => p.Description).HasMaxLength(2000);
    entity.Property(p => p.SKU).HasMaxLength(100).IsRequired();
    entity.HasIndex(p => p.SKU).IsUnique();
    entity.Property(p => p.Price).HasColumnType("decimal(18,2)");
    entity.Property(p => p.Category).HasMaxLength(200).IsRequired();
    entity.Ignore(p => p.IsLowStock);   // Propiedad calculada — EF Core no la persiste
});
```

**¿Por qué `entity.Ignore(p => p.IsLowStock)` si EF Core ya ignora propiedades sin setter?**  
EF Core ignora propiedades sin setter por convención, pero la anotación explícita `.Ignore()` hace la intención obvia a cualquier desarrollador que lea el contexto. En un proyecto de aprendizaje, la claridad vale más que ahorrar una línea. En producción, también es una red de seguridad contra futuras versiones de EF Core que puedan cambiar esa convención.

---

### 7. `ProductsController` (`NexusERP.API/Controllers/ProductsController.cs`)

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Products;
using NexusERP.Core.Services;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ProductService _productService;

    public ProductsController(ProductService productService)
    {
        _productService = productService;
    }

    // GET /api/products?page=1&pageSize=20&search=laptop&category=Electronica&lowStockOnly=true
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ProductQueryParams query)
    {
        var (items, total) = await _productService.GetPagedAsync(query);
        return Ok(new
        {
            items,
            totalCount = total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling((double)total / query.PageSize)
        });
    }

    // GET /api/products/low-stock
    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStock()
    {
        var products = await _productService.GetLowStockAsync();
        return Ok(products);
    }

    // GET /api/products/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var product = await _productService.GetByIdAsync(id);
        return Ok(product);
    }

    // POST /api/products
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductDto dto)
    {
        var product = await _productService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    // PUT /api/products/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductDto dto)
    {
        var product = await _productService.UpdateAsync(id, dto);
        return Ok(product);
    }

    // DELETE /api/products/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _productService.DeleteAsync(id);
        return NoContent();
    }
}
```

**¿Por qué `GET /api/products/low-stock` antes de `GET /api/products/{id:guid}`?**  
ASP.NET Core resuelve las rutas en orden de registro. Si `{id:guid}` estuviera primero, `"low-stock"` podría interpretarse como un intento de Guid (aunque la restricción `:guid` lo previene). Registrar la ruta literal antes es más explícito y elimina cualquier ambigüedad futura si se cambia la restricción.

---

### 8. Modificar `Program.cs`

```csharp
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<ProductService>();
```

---

### 9. Migración de base de datos

```bash
dotnet ef migrations add AddProductsTable --project NexusERP.Infrastructure --startup-project NexusERP.API
dotnet ef database update --project NexusERP.Infrastructure --startup-project NexusERP.API
```

---

## Parte 2 — Frontend

### Archivos a crear

```
src/
├── types/
│   └── product.types.ts
├── services/
│   └── productService.ts
├── hooks/
│   └── useProducts.ts
└── pages/
    └── ProductsPage.tsx
```

---

### 10. Tipos (`src/types/product.types.ts`)

```typescript
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
```

---

### 11. Servicio (`src/services/productService.ts`)

```typescript
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
```

---

### 12. Hooks React Query (`src/hooks/useProducts.ts`)

```typescript
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
```

**¿Por qué las mutaciones invalidan tanto `['products']` como `['products-low-stock']`?**  
Cuando se edita un producto y se cambia su `Stock` o `MinimumStock`, la lista de stock bajo puede cambiar. Si solo se invalidara `['products']`, el widget de stock bajo del caché quedaría desactualizado hasta el próximo refetch automático. Invalidar ambos garantiza consistencia inmediata.

---

### 13. Página `ProductsPage` (`src/pages/ProductsPage.tsx`)

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Inventario                                   [+ Nuevo producto]    │
│                                                                     │
│  🔍 Buscar por nombre o SKU...  [Categoría ▼]  [⚠ Stock bajo]      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Nombre/SKU         Categoría   Precio   Stock    Acciones   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Laptop Pro         Electrónica $1,200   45       ✏️ 🗑️     │   │
│  │ Cable USB          Accesorios  $8.99    ⚠ 2/10   ✏️ 🗑️     │   │  ← stock bajo
│  │ Resma A4           Papelería   $4.50    120      ✏️ 🗑️     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Página 1 de 3  [←] [1] [2] [3] [→]                               │
└─────────────────────────────────────────────────────────────────────┘
```

#### Badge de stock bajo

El stock se muestra en la columna con un indicador visual cuando `isLowStock` es `true`:

```
Stock normal:  45
Stock bajo:    ⚠ 2/10    ← stock actual / mínimo requerido, con ícono de advertencia
```

Se implementa como función interna del componente:

```typescript
function StockCell({ stock, minimumStock, isLowStock }: { stock: number; minimumStock: number; isLowStock: boolean }) {
  if (!isLowStock) return <span>{stock}</span>
  return (
    <span className="stock-low">
      ⚠ {stock}/{minimumStock}
    </span>
  )
}
```

El texto `2/10` comunica tanto el stock actual como el mínimo requerido — el usuario ve de un vistazo cuánto falta para normalizar, sin tener que abrir el detalle del producto.

#### Filtro "Stock bajo"

Un botón toggle (no un select) para activar el filtro `lowStockOnly`:

```typescript
<button
  className={lowStockOnly ? 'btn-filter-active' : 'btn-filter'}
  onClick={() => { setLowStockOnly(!lowStockOnly); setPage(1) }}
>
  ⚠ Stock bajo
</button>
```

Cuando está activo, el botón cambia de estilo (clase `btn-filter-active`) para indicar que el filtro está aplicado.

#### Estado del componente

```typescript
search: string
debouncedSearch: string
categoryFilter: string    // '' = todas las categorías
lowStockOnly: boolean     // false por defecto
page: number
modal: ModalState
deleteConfirm: DeleteConfirm
```

#### Modal crear / editar

```
┌─────────────────────────────────────┐
│  Nuevo producto             [✕]     │
│                                     │
│  Nombre *                           │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  Descripción (opcional)             │
│  ┌─────────────────────────────┐    │
│  │                             │    │  ← textarea
│  └─────────────────────────────┘    │
│                                     │
│  SKU *               Categoría *    │
│  ┌─────────────┐  ┌──────────────┐  │
│  └─────────────┘  └──────────────┘  │
│                                     │
│  Precio *                           │
│  ┌─────────────────────────────┐    │
│  │ $                           │    │  ← type="number", step="0.01"
│  └─────────────────────────────┘    │
│                                     │
│  Stock actual *   Stock mínimo *    │
│  ┌─────────────┐  ┌──────────────┐  │
│  │             │  │              │  │  ← type="number", min="0", step="1"
│  └─────────────┘  └──────────────┘  │
│                                     │
│  [Cancelar]             [Guardar]   │
└─────────────────────────────────────┘
```

El input de SKU se muestra en mayúsculas con `style={{ textTransform: 'uppercase' }}` para dar feedback visual inmediato de la normalización que hará el backend. El valor enviado es el del input, el backend lo normaliza.

#### Selector de categoría

Igual que el módulo de empleados — se extrae de los datos cargados:

```typescript
const categories = [...new Set((data?.items ?? []).map(p => p.category))].sort()
```

---

### 14. Estilos nuevos en `index.css`

```css
/* ── Stock bajo ─────────────────────────────────────────────────────────── */
.stock-low {
  color: #dc2626;
  font-weight: 600;
}

/* ── Botón de filtro toggle ──────────────────────────────────────────────── */
.btn-filter {
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
}

.btn-filter-active {
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid #dc2626;
  background: #fee2e2;
  cursor: pointer;
  font-size: 14px;
  color: #dc2626;
  font-weight: 600;
}
```

---

### 15. Agregar ruta y navegación

**`App.tsx`:** agregar ruta `/products` con `ProtectedRoute`.

**`DashboardPage.tsx`:** agregar botón "Inventario" junto a los botones existentes.

---

## Orden de implementación

1. `Product.cs` — entidad con `IsLowStock` calculado
2. `IProductRepository.cs` — interfaz con `GetLowStockAsync`
3. DTOs (los 4 archivos)
4. `AppDbContext.cs` — `DbSet<Product>` + configuración + `.Ignore(IsLowStock)`
5. `ProductRepository.cs` — EF Core con filtro `lowStockOnly` y `GetLowStockAsync`
6. `ProductService.cs` — CRUD + `GetLowStockAsync`, SKU normalizado a mayúsculas
7. `Program.cs` — registrar dependencias
8. `ProductsController.cs` — 6 endpoints incluyendo `low-stock`
9. Migración EF Core
10. `product.types.ts` — tipos frontend
11. `productService.ts` — llamadas HTTP
12. `useProducts.ts` — hooks React Query con doble invalidación
13. `ProductsPage.tsx` — UI con badge de stock, filtro toggle, modal
14. `index.css` — estilos de stock bajo y botón toggle
15. `App.tsx` — agregar ruta `/products`
16. `DashboardPage.tsx` — agregar botón "Inventario"

---

## Lo que esta spec NO hace

- No implementa movimientos de stock (entradas/salidas con historial) — spec separada
- No implementa ajuste de stock desde la tabla sin abrir el modal (input inline) — spec separada
- No implementa notificaciones automáticas por email cuando el stock baja del mínimo — spec separada
- No implementa relación Product ↔ Project (productos usados en proyectos) — spec separada
- No implementa importación masiva desde CSV/Excel — spec separada
- No implementa código de barras o QR — spec separada
