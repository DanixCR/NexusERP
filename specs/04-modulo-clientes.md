# Spec 04 — Módulo de Clientes

**Estado:** Pendiente de validación  
**Alcance:** Backend (`NexusERP.Core`, `NexusERP.Infrastructure`, `NexusERP.API`) + Frontend (`NexusERP.Client/src/`)  
**Prerequisito:** Spec 03 ejecutada (frontend con autenticación operativa)

---

## Visión general

El módulo de clientes es el primer módulo de negocio del ERP. Permite registrar y administrar las empresas o personas que compran productos/servicios. Este módulo sigue exactamente los mismos patrones que el módulo de autenticación (Clean Architecture, repositorios, servicios, DTOs), lo que lo hace ideal para consolidar esos conceptos.

```
Frontend (React)         Backend (ASP.NET Core)        Base de datos
     │                          │                           │
     │── GET /api/clients ──────►│                           │
     │   ?page=1&search=abc      │── SELECT + WHERE + ───────►│
     │                          │   OFFSET/FETCH             │
     │◄── { items, total } ─────│◄── rows ──────────────────│
     │                          │                           │
     │── POST /api/clients ─────►│                           │
     │   { name, email, ... }    │── INSERT ─────────────────►│
     │◄── 201 Created ──────────│◄── new row ───────────────│
```

---

## Parte 1 — Backend

### Archivos a crear

```
NexusERP.Core/
├── Entities/
│   └── Client.cs
├── Interfaces/
│   └── IClientRepository.cs
├── DTOs/
│   └── Clients/
│       ├── CreateClientDto.cs
│       ├── UpdateClientDto.cs
│       ├── ClientResponseDto.cs
│       └── ClientQueryParams.cs
└── Services/
    └── ClientService.cs

NexusERP.Infrastructure/
└── Repositories/
    └── ClientRepository.cs

NexusERP.API/
└── Controllers/
    └── ClientsController.cs
```

### Archivos a modificar

```
NexusERP.Infrastructure/Data/AppDbContext.cs    ← agregar DbSet<Client>
NexusERP.API/Program.cs                         ← registrar IClientRepository + ClientService
```

---

### 1. Entidad `Client` (`NexusERP.Core/Entities/Client.cs`)

```csharp
namespace NexusERP.Core.Entities;

public class Client
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;       // Razón social o nombre completo
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string TaxId { get; set; } = string.Empty;      // RUC, CUIT, NIF, etc.
    public string? Address { get; set; }                   // Nullable — no siempre disponible
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**¿Por qué `TaxId` y no `Ruc` o `Cuit`?**  
`TaxId` es el término genérico para el identificador fiscal. Si el ERP se usa en varios países (Perú usa RUC, Argentina usa CUIT, España usa NIF), el campo sigue siendo válido sin renombrarlo. Es una decisión de diseño para que el modelo sea agnóstico al país.

**¿Por qué `Address` es nullable?**  
No siempre se tiene la dirección al dar de alta un cliente. Forzar el campo haría que el usuario invente datos. Es mejor permitir `null` y completar después.

**¿Por qué `IsActive` en lugar de eliminar físicamente?**  
El "borrado suave" (soft delete) marca el registro como inactivo en lugar de eliminarlo de la base de datos. Esto preserva la integridad referencial: si un cliente tiene facturas asociadas, no se puede borrar físicamente sin violar las foreign keys. También permite auditoría — se puede ver qué clientes existieron.

---

### 2. Interfaz `IClientRepository` (`NexusERP.Core/Interfaces/IClientRepository.cs`)

```csharp
using NexusERP.Core.Entities;
using NexusERP.Core.DTOs.Clients;

namespace NexusERP.Core.Interfaces;

public interface IClientRepository
{
    Task<Client?> GetByIdAsync(Guid id);
    Task<Client?> GetByTaxIdAsync(string taxId);
    Task<(IEnumerable<Client> Items, int TotalCount)> GetPagedAsync(ClientQueryParams query);
    Task CreateAsync(Client client);
    Task UpdateAsync(Client client);
    Task DeleteAsync(Client client);  // Soft delete: setea IsActive = false
}
```

**¿Qué es `(IEnumerable<Client> Items, int TotalCount)`?**  
Es una tupla de C# — retorna dos valores en una sola llamada. Para una lista paginada se necesitan los registros de la página actual Y el total de registros (para que el frontend pueda calcular cuántas páginas hay). Sin el `TotalCount`, el frontend no sabría si hay más páginas.

**¿Por qué `GetByTaxIdAsync`?**  
Para verificar que no existan dos clientes con el mismo identificador fiscal antes de crear o actualizar. Este chequeo lo hace el servicio, pero necesita preguntar al repositorio.

---

### 3. DTOs (`NexusERP.Core/DTOs/Clients/`)

#### `CreateClientDto.cs`
```csharp
namespace NexusERP.Core.DTOs.Clients;

public class CreateClientDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string TaxId { get; set; } = string.Empty;
    public string? Address { get; set; }
}
```

#### `UpdateClientDto.cs`
```csharp
namespace NexusERP.Core.DTOs.Clients;

public class UpdateClientDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string TaxId { get; set; } = string.Empty;
    public string? Address { get; set; }
}
```

#### `ClientResponseDto.cs`
```csharp
namespace NexusERP.Core.DTOs.Clients;

public class ClientResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string TaxId { get; set; } = string.Empty;
    public string? Address { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

#### `ClientQueryParams.cs`
```csharp
namespace NexusERP.Core.DTOs.Clients;

public class ClientQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }   // Filtra por Name, Email o TaxId
}
```

**¿Por qué `ClientResponseDto` no incluye `IsActive`?**  
Los endpoints solo devuelven clientes activos — un cliente inactivo (borrado) es como si no existiera para el frontend. No tiene sentido exponer ese flag. Si en el futuro se necesita una pantalla de "clientes archivados", se agrega un endpoint separado.

**¿Por qué `CreateClientDto` y `UpdateClientDto` son iguales?**  
Por ahora sí son iguales, pero separarlos es la decisión correcta. En el futuro, `UpdateClientDto` podría tener campos adicionales (ej. `IsActive` para reactivar un cliente) o campos opcionales distintos. Con DTOs separados, ese cambio no rompe nada. Si fueran el mismo objeto, cambiar uno cambiaría el otro.

---

### 4. Servicio `ClientService` (`NexusERP.Core/Services/ClientService.cs`)

```csharp
using NexusERP.Core.DTOs.Clients;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class ClientService
{
    private readonly IClientRepository _clientRepository;

    public ClientService(IClientRepository clientRepository)
    {
        _clientRepository = clientRepository;
    }

    public async Task<(IEnumerable<ClientResponseDto> Items, int TotalCount)>
        GetPagedAsync(ClientQueryParams query)
    {
        var (items, total) = await _clientRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<ClientResponseDto> GetByIdAsync(Guid id)
    {
        var client = await _clientRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Client {id} not found");

        return MapToDto(client);
    }

    public async Task<ClientResponseDto> CreateAsync(CreateClientDto dto)
    {
        var existing = await _clientRepository.GetByTaxIdAsync(dto.TaxId);
        if (existing != null)
            throw new ConflictException($"A client with TaxId '{dto.TaxId}' already exists");

        var client = new Client
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Email = dto.Email.Trim().ToLowerInvariant(),
            Phone = dto.Phone.Trim(),
            TaxId = dto.TaxId.Trim().ToUpperInvariant(),
            Address = dto.Address?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _clientRepository.CreateAsync(client);
        return MapToDto(client);
    }

    public async Task<ClientResponseDto> UpdateAsync(Guid id, UpdateClientDto dto)
    {
        var client = await _clientRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Client {id} not found");

        // Verificar que el nuevo TaxId no pertenezca a otro cliente
        var existing = await _clientRepository.GetByTaxIdAsync(dto.TaxId);
        if (existing != null && existing.Id != id)
            throw new ConflictException($"A client with TaxId '{dto.TaxId}' already exists");

        client.Name = dto.Name.Trim();
        client.Email = dto.Email.Trim().ToLowerInvariant();
        client.Phone = dto.Phone.Trim();
        client.TaxId = dto.TaxId.Trim().ToUpperInvariant();
        client.Address = dto.Address?.Trim();
        client.UpdatedAt = DateTime.UtcNow;

        await _clientRepository.UpdateAsync(client);
        return MapToDto(client);
    }

    public async Task DeleteAsync(Guid id)
    {
        var client = await _clientRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Client {id} not found");

        await _clientRepository.DeleteAsync(client);
    }

    private static ClientResponseDto MapToDto(Client c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Email = c.Email,
        Phone = c.Phone,
        TaxId = c.TaxId,
        Address = c.Address,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };
}
```

**¿Por qué `TaxId.ToUpperInvariant()` al guardar?**  
Para normalizar el dato: "abc123", "ABC123" y "Abc123" son el mismo identificador fiscal. Si no normalizamos, el chequeo de duplicados fallaría. `ToUpperInvariant()` es más seguro que `ToUpper()` porque no depende de la configuración regional del servidor.

**¿Por qué `ClientService` no implementa una interfaz?**  
A diferencia de `AuthService`, este servicio no necesita interfaz porque no hay implementaciones alternativas previstas. La interfaz en `IAuthService` existe porque hay lógica compleja que se quiere abstraer para testing con mocks. Para `ClientService`, el repositorio ya tiene su interfaz — el servicio en sí puede ser concreto. Si en el futuro se necesita mockear, se agrega la interfaz.

---

### 5. Repositorio `ClientRepository` (`NexusERP.Infrastructure/Repositories/ClientRepository.cs`)

```csharp
using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Clients;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly AppDbContext _context;

    public ClientRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Client?> GetByIdAsync(Guid id)
        => await _context.Clients
            .Where(c => c.IsActive)
            .FirstOrDefaultAsync(c => c.Id == id);

    public async Task<Client?> GetByTaxIdAsync(string taxId)
        => await _context.Clients
            .Where(c => c.IsActive)
            .FirstOrDefaultAsync(c => c.TaxId == taxId.ToUpperInvariant());

    public async Task<(IEnumerable<Client> Items, int TotalCount)> GetPagedAsync(ClientQueryParams query)
    {
        var q = _context.Clients
            .Where(c => c.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(c =>
                c.Name.ToLower().Contains(search) ||
                c.Email.ToLower().Contains(search) ||
                c.TaxId.ToLower().Contains(search));
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderBy(c => c.Name)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task CreateAsync(Client client)
    {
        await _context.Clients.AddAsync(client);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Client client)
    {
        _context.Clients.Update(client);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Client client)
    {
        client.IsActive = false;
        client.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
```

**¿Qué hace `Skip` y `Take`?**  
Son los operadores de paginación de LINQ que EF Core traduce a SQL:
- `Skip((page - 1) * pageSize)` → `OFFSET N ROWS` en SQL Server
- `Take(pageSize)` → `FETCH NEXT N ROWS ONLY`

Para la página 1 con 20 registros: `Skip(0).Take(20)`. Para la página 2: `Skip(20).Take(20)`.

**¿Por qué contar antes de paginar (`CountAsync` antes del `Skip/Take`)?**  
`CountAsync` cuenta el total de registros que coinciden con los filtros (sin paginación). Ese número es necesario para que el frontend calcule la cantidad total de páginas: `totalPages = Math.ceil(total / pageSize)`. Si se contara después del `Take`, siempre devolvería como máximo `pageSize` (20), no el real.

**¿Por qué `Where(c => c.IsActive)` en todos los métodos?**  
El filtro de soft delete debe estar en el repositorio, no en el servicio. Si estuviera en el servicio, cualquier consulta directa al repositorio desde otro lugar devolvería también los registros inactivos. El repositorio es la única fuente de verdad sobre qué datos existen.

---

### 6. Modificar `AppDbContext`

Agregar en `AppDbContext.cs`:

```csharp
// Nueva propiedad:
public DbSet<Client> Clients => Set<Client>();

// En OnModelCreating, agregar:
modelBuilder.Entity<Client>(entity =>
{
    entity.HasKey(c => c.Id);
    entity.Property(c => c.Id).ValueGeneratedNever();
    entity.HasIndex(c => c.TaxId).IsUnique();
    entity.Property(c => c.Name).HasMaxLength(200).IsRequired();
    entity.Property(c => c.Email).HasMaxLength(256).IsRequired();
    entity.Property(c => c.Phone).HasMaxLength(50).IsRequired();
    entity.Property(c => c.TaxId).HasMaxLength(50).IsRequired();
    entity.Property(c => c.Address).HasMaxLength(500);
});
```

**¿Por qué `HasIndex(c => c.TaxId).IsUnique()`?**  
El índice único en `TaxId` se aplica a nivel de base de datos — es la red de seguridad final. Aunque el servicio ya verifica duplicados en código, es posible que en el futuro dos requests simultáneos pasen el chequeo al mismo tiempo (race condition). El índice único en SQL Server garantiza que solo uno de los dos INSERT tenga éxito.

---

### 7. `ClientsController` (`NexusERP.API/Controllers/ClientsController.cs`)

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Clients;
using NexusERP.Core.Services;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/clients")]
[Authorize]                    // Todos los endpoints requieren JWT válido
public class ClientsController : ControllerBase
{
    private readonly ClientService _clientService;

    public ClientsController(ClientService clientService)
    {
        _clientService = clientService;
    }

    // GET /api/clients?page=1&pageSize=20&search=abc
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ClientQueryParams query)
    {
        var (items, total) = await _clientService.GetPagedAsync(query);
        return Ok(new
        {
            items,
            totalCount = total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling((double)total / query.PageSize)
        });
    }

    // GET /api/clients/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var client = await _clientService.GetByIdAsync(id);
        return Ok(client);
    }

    // POST /api/clients
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateClientDto dto)
    {
        var client = await _clientService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = client.Id }, client);
    }

    // PUT /api/clients/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateClientDto dto)
    {
        var client = await _clientService.UpdateAsync(id, dto);
        return Ok(client);
    }

    // DELETE /api/clients/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _clientService.DeleteAsync(id);
        return NoContent();
    }
}
```

**¿Qué hace `CreatedAtAction`?**  
`CreatedAtAction` devuelve HTTP 201 Created e incluye en el header `Location` la URL del recurso recién creado (ej. `https://localhost:7052/api/clients/abc-123`). Es el comportamiento estándar REST para recursos creados. El frontend puede ignorar ese header, pero APIs que siguen REST correctamente lo incluyen.

**¿Por qué `{id:guid}` en la ruta?**  
El constraint `:guid` hace que el router de ASP.NET Core solo enrute la request si el parámetro es un GUID válido. Si alguien llama `GET /api/clients/hola`, el router devuelve 404 directamente sin llegar al controller. Sin el constraint, llegaría al controller con un error de binding.

**¿Por qué `[Authorize]` a nivel de controller y no de endpoint?**  
Poniéndolo en el controller, aplica a todos los endpoints del módulo. Si se pusiera en cada método individualmente, sería fácil olvidarlo al agregar uno nuevo. El comportamiento por defecto es "todo protegido" — si algún endpoint debe ser público, se le agrega `[AllowAnonymous]` explícitamente.

---

### 8. Modificar `Program.cs`

Agregar en la sección de inyección de dependencias:

```csharp
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<ClientService>();
```

---

### 9. Migración de base de datos

Después de implementar, ejecutar:

```bash
dotnet ef migrations add AddClientsTable --project NexusERP.Infrastructure --startup-project NexusERP.API
dotnet ef database update --project NexusERP.Infrastructure --startup-project NexusERP.API
```

---

## Parte 2 — Frontend

### Archivos a crear

```
src/
├── types/
│   └── client.types.ts
├── services/
│   └── clientService.ts
├── hooks/
│   └── useClients.ts
└── pages/
    └── ClientsPage.tsx
```

---

### 10. Tipos (`src/types/client.types.ts`)

```typescript
export type Client = {
  id: string
  name: string
  email: string
  phone: string
  taxId: string
  address: string | null
  createdAt: string   // ISO 8601
  updatedAt: string
}

export type CreateClientRequest = {
  name: string
  email: string
  phone: string
  taxId: string
  address: string | null
}

export type UpdateClientRequest = CreateClientRequest

export type ClientQueryParams = {
  page?: number
  pageSize?: number
  search?: string
}

export type PagedResponse<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}
```

**¿Por qué `PagedResponse<T>` es genérico?**  
En el futuro habrá `PagedResponse<Product>`, `PagedResponse<Invoice>`, etc. Con un tipo genérico se define una sola vez y se reutiliza. Sin genéricos, habría que copiar la estructura para cada módulo.

---

### 11. Servicio (`src/services/clientService.ts`)

```typescript
import { apiClient } from '../lib/axios'
import type { Client, CreateClientRequest, UpdateClientRequest, ClientQueryParams, PagedResponse } from '../types/client.types'

export const clientService = {
  getAll(params?: ClientQueryParams): Promise<PagedResponse<Client>> {
    return apiClient.get<PagedResponse<Client>>('/clients', { params }).then(r => r.data)
  },

  getById(id: string): Promise<Client> {
    return apiClient.get<Client>(`/clients/${id}`).then(r => r.data)
  },

  create(data: CreateClientRequest): Promise<Client> {
    return apiClient.post<Client>('/clients', data).then(r => r.data)
  },

  update(id: string, data: UpdateClientRequest): Promise<Client> {
    return apiClient.put<Client>(`/clients/${id}`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/clients/${id}`).then(() => undefined)
  },
}
```

---

### 12. Hook con React Query (`src/hooks/useClients.ts`)

React Query maneja el caché, loading states, revalidación y sincronización automática. El hook encapsula toda esa lógica.

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientService } from '../services/clientService'
import type { CreateClientRequest, UpdateClientRequest, ClientQueryParams } from '../types/client.types'

// Clave de caché — React Query identifica los datos por esta key.
// Incluir los params asegura que cada combinación de filtros tenga su propio caché.
const CLIENTS_KEY = (params?: ClientQueryParams) => ['clients', params]

export function useClients(params?: ClientQueryParams) {
  return useQuery({
    queryKey: CLIENTS_KEY(params),
    queryFn: () => clientService.getAll(params),
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateClientRequest) => clientService.create(data),
    onSuccess: () => {
      // Invalidar el caché de la lista para que se recargue con el nuevo cliente
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientRequest }) =>
      clientService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => clientService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
```

**¿Qué es React Query y por qué usarlo?**  
React Query gestiona el ciclo de vida de los datos del servidor: loading, error, éxito, caché, revalidación. Sin React Query, habría que manejar manualmente estados `isLoading`, `error`, efectos de limpieza, y la lista se vería desactualizada hasta que el usuario recargue la página. Con `invalidateQueries`, React Query automáticamente refetch la lista cuando se crea, edita o elimina un cliente.

**¿Qué es `invalidateQueries`?**  
Marca el caché de una query como "stale" (desactualizado). React Query lo refetch en el background o la próxima vez que el componente esté visible. Es la forma de decir: "este dato cambió, volvé a buscarlo".

---

### 13. Página `ClientsPage` (`src/pages/ClientsPage.tsx`)

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  Clientes                          [+ Nuevo cliente] │
│                                                      │
│  🔍 Buscar por nombre, email o RUC...               │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Nombre       Email          RUC      Acciones│   │
│  ├──────────────────────────────────────────────┤   │
│  │ Acme Corp    acme@...    20123...  ✏️  🗑️   │   │
│  │ Beta SRL     beta@...    20456...  ✏️  🗑️   │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Página 1 de 3  [←] [1] [2] [3] [→]                │
└─────────────────────────────────────────────────────┘
```

#### Modal crear/editar

```
┌─────────────────────────────────────┐
│  Nuevo cliente              [✕]     │
│                                     │
│  Nombre *                           │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  Email *                            │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  Teléfono *                         │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  RUC / Identificador fiscal *       │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  Dirección (opcional)               │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  [Cancelar]          [Guardar]      │
└─────────────────────────────────────┘
```

#### Estado del componente

```typescript
search: string                   // valor del input de búsqueda
page: number                     // página actual (empieza en 1)
modalState: {
  open: boolean
  mode: 'create' | 'edit'
  client: Client | null          // null en modo create, Client en modo edit
}
deleteConfirm: {
  open: boolean
  clientId: string | null        // el cliente que se está por borrar
}
```

#### Comportamiento

**Búsqueda:**
```
- Input con debounce de 300ms (evita llamar al API en cada tecla)
- Al escribir → actualizar `search` → React Query refetch con el nuevo parámetro
- Al limpiar → volver a página 1
```

**¿Qué es debounce?**  
Es un mecanismo que espera N milisegundos después del último evento antes de ejecutar la acción. Sin debounce, escribir "nexus" dispararía 5 requests ("n", "ne", "nex", "nexu", "nexus"). Con debounce de 300ms, solo se dispara el request cuando el usuario deja de escribir.

**Crear cliente:**
```
1. Click en "Nuevo cliente" → abrir modal en modo 'create' con campos vacíos
2. Usuario completa el formulario → click en "Guardar"
3. Llamar useCreateClient.mutate(formData)
4. Si éxito → cerrar modal, React Query invalida caché → lista se actualiza sola
5. Si error 409 (TaxId duplicado) → mostrar "Ya existe un cliente con ese RUC"
6. Si otro error → "Error inesperado. Intentá de nuevo."
```

**Editar cliente:**
```
1. Click en ✏️ de una fila → abrir modal en modo 'edit' con campos pre-llenados del cliente
2. Usuario modifica → click en "Guardar"
3. Llamar useUpdateClient.mutate({ id, data: formData })
4. Mismo manejo de éxito/error que crear
```

**Eliminar cliente:**
```
1. Click en 🗑️ de una fila → abrir diálogo de confirmación:
   "¿Eliminar a [nombre]? Esta acción no se puede deshacer."
   [Cancelar] [Eliminar]
2. Click en "Eliminar" → llamar useDeleteClient.mutate(id)
3. Si éxito → React Query invalida caché → cliente desaparece de la lista
```

**¿Por qué pedir confirmación antes de eliminar?**  
El borrado es la operación más difícil de deshacer (aunque sea soft delete, recuperar un cliente requiere intervención en la base de datos). Una confirmación explícita previene eliminaciones accidentales, especialmente en tablas con botones pequeños.

**Paginación:**
```
- Botones de página generados desde totalPages (devuelto por el API)
- Click en página → actualizar `page` → React Query refetch
- Al cambiar filtro de búsqueda → resetear page a 1
```

---

## Orden de implementación

Una vez validada esta spec:

1. `Client.cs` — entidad
2. `IClientRepository.cs` — interfaz
3. DTOs (los 4 archivos)
4. `AppDbContext.cs` — agregar DbSet + configuración
5. `ClientRepository.cs` — implementación EF Core
6. `ClientService.cs` — lógica de negocio
7. `Program.cs` — registrar dependencias
8. `ClientsController.cs` — endpoints
9. Migración EF Core
10. `client.types.ts` — tipos frontend
11. `clientService.ts` — llamadas HTTP
12. `useClients.ts` — hooks React Query
13. `ClientsPage.tsx` — UI completa
14. `App.tsx` — agregar ruta `/clients`

---

## Lo que esta spec NO hace

- No implementa permisos por rol (ej. solo administradores pueden eliminar) — spec de roles separada
- No implementa exportación a Excel/CSV — spec separada
- No implementa historial de cambios (auditoría) — spec separada
- No implementa la relación Cliente → Facturas — se cubre cuando se implemente el módulo de facturación
