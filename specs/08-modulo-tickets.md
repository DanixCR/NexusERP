# Spec 08 — Módulo de Tickets

**Estado:** Pendiente de validación  
**Alcance:** Backend (`NexusERP.Core`, `NexusERP.Infrastructure`, `NexusERP.API`) + Frontend (`NexusERP.Client/src/`)  
**Prerequisito:** Specs 04, 06 ejecutadas (tablas `Clients` y `Employees` operativas)

---

## Visión general

Un ticket representa una solicitud de soporte, tarea o incidencia que la empresa necesita gestionar. Este módulo introduce tres conceptos nuevos: **dos enums en la misma entidad** (Priority y Status), **dos foreign keys opcionales** (un ticket puede existir sin cliente ni empleado asignado), y un **endpoint PATCH dedicado** para cambiar el estado de un ticket sin tener que enviar todos sus campos.

```
Client (0..1) ──────────── (N) Ticket (N) ──────────── (0..1) Employee
                                  │
                          Priority: Low/Medium/High/Critical
                          Status:   Open/InProgress/Resolved/Closed
```

Las relaciones son opcionales en ambos extremos: un ticket puede crearse sin cliente (problema interno) y sin empleado asignado (pendiente de asignación).

---

## Parte 1 — Backend

### Archivos a crear

```
NexusERP.Core/
├── Entities/
│   ├── Ticket.cs
│   ├── TicketPriority.cs     ← enum
│   └── TicketStatus.cs       ← enum
├── Interfaces/
│   └── ITicketRepository.cs
├── DTOs/
│   └── Tickets/
│       ├── CreateTicketDto.cs
│       ├── UpdateTicketDto.cs
│       ├── ChangeTicketStatusDto.cs
│       ├── TicketResponseDto.cs
│       └── TicketQueryParams.cs
└── Services/
    └── TicketService.cs

NexusERP.Infrastructure/
└── Repositories/
    └── TicketRepository.cs

NexusERP.API/
└── Controllers/
    └── TicketsController.cs
```

### Archivos a modificar

```
NexusERP.Infrastructure/Data/AppDbContext.cs   ← agregar DbSet<Ticket> + configuración
NexusERP.API/Program.cs                        ← registrar ITicketRepository + TicketService
```

---

### 1. Enum `TicketPriority` (`NexusERP.Core/Entities/TicketPriority.cs`)

```csharp
namespace NexusERP.Core.Entities;

public enum TicketPriority
{
    Low,       // Baja — sin impacto inmediato en operaciones
    Medium,    // Media — afecta productividad pero tiene workaround
    High,      // Alta — impacto significativo, requiere atención pronto
    Critical   // Crítica — sistema caído o pérdida de datos, urgente
}
```

### 2. Enum `TicketStatus` (`NexusERP.Core/Entities/TicketStatus.cs`)

```csharp
namespace NexusERP.Core.Entities;

public enum TicketStatus
{
    Open,        // Abierto — recibido, pendiente de atención
    InProgress,  // En progreso — siendo trabajado por un empleado
    Resolved,    // Resuelto — solución aplicada, esperando confirmación
    Closed       // Cerrado — confirmado y archivado
}
```

**¿Por qué dos enums separados y no uno solo?**  
`Priority` y `Status` son dimensiones ortogonales de un ticket: uno describe su urgencia, el otro su ciclo de vida. Mezclarlos en un solo enum no tendría semántica coherente. Separados, cada uno puede evolucionar de forma independiente (ej. agregar `Urgent` a Priority sin tocar Status).

**¿Por qué el estado inicial siempre es `Open`?**  
Un ticket recién creado no puede estar `InProgress` (nadie lo tomó aún) ni `Resolved` (no se trabajó). `Open` es el único estado inicial válido desde el negocio. El servicio lo asigna internamente — no se expone en `CreateTicketDto`.

---

### 3. Entidad `Ticket` (`NexusERP.Core/Entities/Ticket.cs`)

```csharp
namespace NexusERP.Core.Entities;

public class Ticket
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketPriority Priority { get; set; }
    public TicketStatus Status { get; set; }
    public string Category { get; set; } = string.Empty;

    // FK opcionales — ambas pueden ser null
    public Guid? ClientId { get; set; }
    public Client? Client { get; set; }

    public Guid? AssignedEmployeeId { get; set; }
    public Employee? AssignedEmployee { get; set; }

    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**¿Por qué las navigation properties son `Client?` y `Employee?` en lugar de `Client` y `Employee`?**  
En el módulo de proyectos, `Client` era requerido (`null!`) porque todo proyecto tiene un cliente. Aquí, ambas FKs son opcionales. Usar `Client?` y `Employee?` le dice al compilador que esas propiedades pueden ser `null`, evitando un `NullReferenceException` si se accede a `ticket.Client.Name` sin haber cargado la relación. El `?` fuerza a manejar el null explícitamente en el código.

**¿Por qué `Description` es requerida (no nullable) en un ticket?**  
A diferencia de `Project.Description` (opcional), la descripción de un ticket es parte esencial del contexto — sin ella, el soporte no puede entender qué resolver. Hacerla requerida en el modelo refleja esa regla de negocio.

---

### 4. Interfaz `ITicketRepository` (`NexusERP.Core/Interfaces/ITicketRepository.cs`)

```csharp
using NexusERP.Core.DTOs.Tickets;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface ITicketRepository
{
    Task<Ticket?> GetByIdAsync(Guid id);
    Task<(IEnumerable<Ticket> Items, int TotalCount)> GetPagedAsync(TicketQueryParams query);
    Task CreateAsync(Ticket ticket);
    Task UpdateAsync(Ticket ticket);
    Task DeleteAsync(Ticket ticket);
}
```

No hay `GetByTitleAsync` ni similar — los tickets no tienen un campo de unicidad de negocio. Dos tickets con el mismo título para el mismo cliente son válidos (podría ser el mismo problema recurrente).

---

### 5. DTOs (`NexusERP.Core/DTOs/Tickets/`)

#### `CreateTicketDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Tickets;

public class CreateTicketDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketPriority Priority { get; set; }
    public string Category { get; set; } = string.Empty;
    public Guid? ClientId { get; set; }
    public Guid? AssignedEmployeeId { get; set; }
    // Status no está — siempre empieza en Open
}
```

**¿Por qué `Priority` SÍ está en `CreateTicketDto` pero `Status` NO?**  
La prioridad la define quien crea el ticket (el cliente o el operador que lo recibe sabe si es crítico desde el inicio). El estado es parte del ciclo de vida interno y siempre empieza en `Open` — permitir elegirlo al crear abriría la puerta a tickets creados directamente en `Closed`, sin historial de trabajo.

#### `UpdateTicketDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Tickets;

public class UpdateTicketDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketPriority Priority { get; set; }
    public string Category { get; set; } = string.Empty;
    public Guid? ClientId { get; set; }
    public Guid? AssignedEmployeeId { get; set; }
    // Status tampoco aquí — el estado se cambia exclusivamente por ChangeTicketStatusDto
}
```

**¿Por qué `Status` no está en `UpdateTicketDto`?**  
Separar el cambio de estado del resto de los campos es una decisión de diseño deliberada. El ciclo de vida de un ticket (`Open → InProgress → Resolved → Closed`) es una operación de negocio distinta a editar su título o asignación. Tener un endpoint `PATCH /api/tickets/{id}/status` separado hace explícita esa semántica: editar un ticket (PUT) y avanzar su estado (PATCH) son acciones diferentes.

#### `ChangeTicketStatusDto.cs`

```csharp
using NexusERP.Core.Entities;

namespace NexusERP.Core.DTOs.Tickets;

public class ChangeTicketStatusDto
{
    public TicketStatus Status { get; set; }
}
```

**¿Por qué un DTO separado para cambiar el estado?**  
El endpoint `PATCH /api/tickets/{id}/status` recibe exactamente un campo: el nuevo estado. Un DTO propio documenta esto claramente en la API. Reutilizar `UpdateTicketDto` obligaría al cliente HTTP a enviar todos los campos del ticket aunque solo quiera cambiar el estado.

#### `TicketResponseDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Tickets;

public class TicketResponseDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;   // String del enum: "Low", "High", etc.
    public string Status { get; set; } = string.Empty;     // String del enum: "Open", "InProgress", etc.
    public string Category { get; set; } = string.Empty;
    public Guid? ClientId { get; set; }
    public string? ClientName { get; set; }                // Null si no tiene cliente asignado
    public Guid? AssignedEmployeeId { get; set; }
    public string? AssignedEmployeeName { get; set; }      // Null si no está asignado
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**¿Por qué `ClientName` y `AssignedEmployeeName` son `string?` y no `string`?**  
Ambas relaciones son opcionales. Si un ticket no tiene cliente, `ClientName` será `null`. Usar `string?` en el DTO refleja fielmente la realidad del dominio y evita devolver strings vacíos (`""`) que el frontend tendría que distinguir de `null`.

#### `TicketQueryParams.cs`

```csharp
namespace NexusERP.Core.DTOs.Tickets;

public class TicketQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }         // Filtra por título
    public string? Status { get; set; }         // Filtra por estado ("Open", "InProgress", etc.)
    public string? Priority { get; set; }       // Filtra por prioridad ("Low", "High", etc.)
    public Guid? ClientId { get; set; }         // Filtra por cliente
    public Guid? AssignedEmployeeId { get; set; } // Filtra por empleado asignado
}
```

`Status` y `Priority` son `string?` por la misma razón que `ProjectQueryParams.Status`: se parsean con `Enum.TryParse` en el repositorio para ignorar silenciosamente valores inválidos.

---

### 6. Servicio `TicketService` (`NexusERP.Core/Services/TicketService.cs`)

```csharp
using NexusERP.Core.DTOs.Tickets;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class TicketService
{
    private readonly ITicketRepository _ticketRepository;

    public TicketService(ITicketRepository ticketRepository)
    {
        _ticketRepository = ticketRepository;
    }

    public async Task<(IEnumerable<TicketResponseDto> Items, int TotalCount)> GetPagedAsync(TicketQueryParams query)
    {
        var (items, total) = await _ticketRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<TicketResponseDto> GetByIdAsync(Guid id)
    {
        var ticket = await _ticketRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Ticket {id} not found");

        return MapToDto(ticket);
    }

    public async Task<TicketResponseDto> CreateAsync(CreateTicketDto dto)
    {
        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            Title = dto.Title.Trim(),
            Description = dto.Description.Trim(),
            Priority = dto.Priority,
            Status = TicketStatus.Open,    // Siempre empieza en Open
            Category = dto.Category.Trim(),
            ClientId = dto.ClientId,
            AssignedEmployeeId = dto.AssignedEmployeeId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _ticketRepository.CreateAsync(ticket);

        // GetByIdAsync recarga el ticket con las navigation properties incluidas
        // (Client y AssignedEmployee) para que MapToDto pueda acceder a sus nombres.
        return await GetByIdAsync(ticket.Id);
    }

    public async Task<TicketResponseDto> UpdateAsync(Guid id, UpdateTicketDto dto)
    {
        var ticket = await _ticketRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Ticket {id} not found");

        ticket.Title = dto.Title.Trim();
        ticket.Description = dto.Description.Trim();
        ticket.Priority = dto.Priority;
        ticket.Category = dto.Category.Trim();
        ticket.ClientId = dto.ClientId;
        ticket.AssignedEmployeeId = dto.AssignedEmployeeId;
        ticket.UpdatedAt = DateTime.UtcNow;

        await _ticketRepository.UpdateAsync(ticket);
        return await GetByIdAsync(ticket.Id);
    }

    public async Task<TicketResponseDto> ChangeStatusAsync(Guid id, ChangeTicketStatusDto dto)
    {
        var ticket = await _ticketRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Ticket {id} not found");

        ticket.Status = dto.Status;
        ticket.UpdatedAt = DateTime.UtcNow;

        await _ticketRepository.UpdateAsync(ticket);
        return await GetByIdAsync(ticket.Id);
    }

    public async Task DeleteAsync(Guid id)
    {
        var ticket = await _ticketRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Ticket {id} not found");

        await _ticketRepository.DeleteAsync(ticket);
    }

    private static TicketResponseDto MapToDto(Ticket t) => new()
    {
        Id = t.Id,
        Title = t.Title,
        Description = t.Description,
        Priority = t.Priority.ToString(),
        Status = t.Status.ToString(),
        Category = t.Category,
        ClientId = t.ClientId,
        ClientName = t.Client?.Name,
        AssignedEmployeeId = t.AssignedEmployeeId,
        AssignedEmployeeName = t.AssignedEmployee != null
            ? $"{t.AssignedEmployee.FirstName} {t.AssignedEmployee.LastName}"
            : null,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt
    };
}
```

**¿Por qué `CreateAsync` y `UpdateAsync` llaman a `GetByIdAsync` después de guardar?**  
A diferencia del módulo de empleados (donde no hay navigation properties), `MapToDto` aquí accede a `t.Client?.Name` y `t.AssignedEmployee`. Después de un `CreateAsync` o `UpdateAsync`, EF Core no carga automáticamente las navigation properties — solo conoce las FKs. En lugar de asignarlas manualmente (como en proyectos) o devolver datos incompletos, se hace un `GetByIdAsync` que incluye los `Include()` necesarios. El coste es una query adicional por operación de escritura, aceptable para una operación que ocurre una vez por acción del usuario.

---

### 7. Repositorio `TicketRepository` (`NexusERP.Infrastructure/Repositories/TicketRepository.cs`)

```csharp
using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Tickets;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class TicketRepository : ITicketRepository
{
    private readonly AppDbContext _context;

    public TicketRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Ticket?> GetByIdAsync(Guid id)
        => await _context.Tickets
            .Include(t => t.Client)
            .Include(t => t.AssignedEmployee)
            .Where(t => t.IsActive)
            .FirstOrDefaultAsync(t => t.Id == id);

    public async Task<(IEnumerable<Ticket> Items, int TotalCount)> GetPagedAsync(TicketQueryParams query)
    {
        var q = _context.Tickets
            .Include(t => t.Client)
            .Include(t => t.AssignedEmployee)
            .Where(t => t.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(t => t.Title.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.Status) &&
            Enum.TryParse<TicketStatus>(query.Status, ignoreCase: true, out var status))
        {
            q = q.Where(t => t.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(query.Priority) &&
            Enum.TryParse<TicketPriority>(query.Priority, ignoreCase: true, out var priority))
        {
            q = q.Where(t => t.Priority == priority);
        }

        if (query.ClientId.HasValue)
            q = q.Where(t => t.ClientId == query.ClientId.Value);

        if (query.AssignedEmployeeId.HasValue)
            q = q.Where(t => t.AssignedEmployeeId == query.AssignedEmployeeId.Value);

        var total = await q.CountAsync();

        var items = await q
            .OrderByDescending(t => t.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task CreateAsync(Ticket ticket)
    {
        await _context.Tickets.AddAsync(ticket);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Ticket ticket)
    {
        _context.Tickets.Update(ticket);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Ticket ticket)
    {
        ticket.IsActive = false;
        ticket.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
```

**¿Por qué `.Include(t => t.Client)` e `.Include(t => t.AssignedEmployee)` en todas las consultas si las relaciones son opcionales?**  
EF Core hace un `LEFT JOIN` cuando la FK es nullable. Si el ticket no tiene cliente asignado, `t.Client` será `null` — no lanza error. El `Include` con FK nullable simplemente no carga nada para esas filas; es equivalente a `LEFT OUTER JOIN` en SQL.

**¿Por qué ordenar por `CreatedAt` descendente y no por prioridad?**  
Los tickets se suelen gestionar por orden de llegada combinado con el filtro de prioridad. Si se ordenara automáticamente por prioridad, los tickets `Critical` siempre aparecerían primero aunque ya estén `Resolved`. El usuario puede filtrar por prioridad cuando necesite ver solo los críticos; el orden por defecto refleja el flujo natural de trabajo (lo más reciente primero).

---

### 8. Modificar `AppDbContext`

```csharp
// Nueva propiedad:
public DbSet<Ticket> Tickets => Set<Ticket>();

// En OnModelCreating, agregar:
modelBuilder.Entity<Ticket>(entity =>
{
    entity.HasKey(t => t.Id);
    entity.Property(t => t.Id).ValueGeneratedNever();
    entity.Property(t => t.Title).HasMaxLength(500).IsRequired();
    entity.Property(t => t.Description).HasMaxLength(4000).IsRequired();
    entity.Property(t => t.Priority)
          .HasConversion<string>()
          .HasMaxLength(20)
          .IsRequired();
    entity.Property(t => t.Status)
          .HasConversion<string>()
          .HasMaxLength(20)
          .IsRequired();
    entity.Property(t => t.Category).HasMaxLength(200).IsRequired();

    entity.HasOne(t => t.Client)
          .WithMany()
          .HasForeignKey(t => t.ClientId)
          .OnDelete(DeleteBehavior.Restrict)
          .IsRequired(false);

    entity.HasOne(t => t.AssignedEmployee)
          .WithMany()
          .HasForeignKey(t => t.AssignedEmployeeId)
          .OnDelete(DeleteBehavior.SetNull)
          .IsRequired(false);
});
```

**¿Por qué `DeleteBehavior.Restrict` para Client pero `DeleteBehavior.SetNull` para Employee?**  
Son dos relaciones con semánticas distintas:
- Si un **cliente** fuera borrado físicamente, sus tickets quedarían huérfanos sin contexto de negocio — `Restrict` protege contra eso bloqueando la eliminación.
- Si un **empleado** deja la empresa y es dado de baja, sus tickets asignados no deberían ser bloqueantes ni perderse. `SetNull` limpia el `AssignedEmployeeId` automáticamente: el ticket queda desasignado (`null`) y puede reasignarse a otro empleado.

**¿Por qué `.IsRequired(false)` explícito si la FK ya es nullable (`Guid?`)?**  
EF Core infiere `IsRequired(false)` de la FK nullable, pero la anotación explícita hace la intención obvia en la configuración del modelo. Es coherente con la decisión de `entity.Ignore(p => p.IsLowStock)` en el módulo de inventario: claridad sobre brevedad.

---

### 9. `TicketsController` (`NexusERP.API/Controllers/TicketsController.cs`)

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Tickets;
using NexusERP.Core.Services;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/tickets")]
[Authorize]
public class TicketsController : ControllerBase
{
    private readonly TicketService _ticketService;

    public TicketsController(TicketService ticketService)
    {
        _ticketService = ticketService;
    }

    // GET /api/tickets?page=1&pageSize=20&search=login&status=Open&priority=High
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] TicketQueryParams query)
    {
        var (items, total) = await _ticketService.GetPagedAsync(query);
        return Ok(new
        {
            items,
            totalCount = total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling((double)total / query.PageSize)
        });
    }

    // GET /api/tickets/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var ticket = await _ticketService.GetByIdAsync(id);
        return Ok(ticket);
    }

    // POST /api/tickets
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTicketDto dto)
    {
        var ticket = await _ticketService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = ticket.Id }, ticket);
    }

    // PUT /api/tickets/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTicketDto dto)
    {
        var ticket = await _ticketService.UpdateAsync(id, dto);
        return Ok(ticket);
    }

    // PATCH /api/tickets/{id}/status
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeTicketStatusDto dto)
    {
        var ticket = await _ticketService.ChangeStatusAsync(id, dto);
        return Ok(ticket);
    }

    // DELETE /api/tickets/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _ticketService.DeleteAsync(id);
        return NoContent();
    }
}
```

**¿Por qué `PATCH` y no `PUT` para el cambio de estado?**  
HTTP `PUT` reemplaza el recurso completo; `PATCH` aplica una modificación parcial. Cambiar solo el estado de un ticket es una modificación parcial por definición. Usar `PATCH` comunica eso con precisión a cualquier consumidor de la API (otro frontend, integración con Slack, script de automatización). También permite validar que el body solo contiene `status`, sin otros campos que no deberían cambiarse por esta vía.

---

### 10. Modificar `Program.cs`

```csharp
builder.Services.AddScoped<ITicketRepository, TicketRepository>();
builder.Services.AddScoped<TicketService>();
```

---

### 11. Migración de base de datos

```bash
dotnet ef migrations add AddTicketsTable --project NexusERP.Infrastructure --startup-project NexusERP.API
dotnet ef database update --project NexusERP.Infrastructure --startup-project NexusERP.API
```

---

## Parte 2 — Frontend

### Archivos a crear

```
src/
├── types/
│   └── ticket.types.ts
├── services/
│   └── ticketService.ts
├── hooks/
│   └── useTickets.ts
└── pages/
    └── TicketsPage.tsx
```

### Archivos a modificar

```
src/hooks/useProjects.ts   ← extraer useAllEmployees (actualmente solo tiene useAllClients)
src/App.tsx                ← agregar ruta /tickets
src/pages/DashboardPage.tsx ← agregar botón "Tickets"
src/index.css              ← agregar badges de prioridad
```

---

### 12. Tipos (`src/types/ticket.types.ts`)

```typescript
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical'
export type TicketStatus   = 'Open' | 'InProgress' | 'Resolved' | 'Closed'

export type Ticket = {
  id: string
  title: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  category: string
  clientId: string | null
  clientName: string | null
  assignedEmployeeId: string | null
  assignedEmployeeName: string | null
  createdAt: string
  updatedAt: string
}

export type CreateTicketRequest = {
  title: string
  description: string
  priority: TicketPriority
  category: string
  clientId: string | null
  assignedEmployeeId: string | null
}

export type UpdateTicketRequest = CreateTicketRequest

export type ChangeTicketStatusRequest = {
  status: TicketStatus
}

export type TicketQueryParams = {
  page?: number
  pageSize?: number
  search?: string
  status?: TicketStatus
  priority?: TicketPriority
  clientId?: string
  assignedEmployeeId?: string
}
```

---

### 13. Servicio (`src/services/ticketService.ts`)

```typescript
import { apiClient } from '../lib/axios'
import type { Ticket, CreateTicketRequest, UpdateTicketRequest, ChangeTicketStatusRequest, TicketQueryParams } from '../types/ticket.types'
import type { PagedResponse } from '../types/client.types'

export const ticketService = {
  getAll(params?: TicketQueryParams): Promise<PagedResponse<Ticket>> {
    return apiClient.get<PagedResponse<Ticket>>('/tickets', { params }).then(r => r.data)
  },

  getById(id: string): Promise<Ticket> {
    return apiClient.get<Ticket>(`/tickets/${id}`).then(r => r.data)
  },

  create(data: CreateTicketRequest): Promise<Ticket> {
    return apiClient.post<Ticket>('/tickets', data).then(r => r.data)
  },

  update(id: string, data: UpdateTicketRequest): Promise<Ticket> {
    return apiClient.put<Ticket>(`/tickets/${id}`, data).then(r => r.data)
  },

  changeStatus(id: string, data: ChangeTicketStatusRequest): Promise<Ticket> {
    return apiClient.patch<Ticket>(`/tickets/${id}/status`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/tickets/${id}`).then(() => undefined)
  },
}
```

---

### 14. Hooks React Query (`src/hooks/useTickets.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketService } from '../services/ticketService'
import type { CreateTicketRequest, UpdateTicketRequest, ChangeTicketStatusRequest, TicketQueryParams } from '../types/ticket.types'

export function useTickets(params?: TicketQueryParams) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: () => ticketService.getAll(params),
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTicketRequest) => ticketService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTicketRequest }) =>
      ticketService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useChangeTicketStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeTicketStatusRequest }) =>
      ticketService.changeStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ticketService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
```

---

### 15. Hook `useAllEmployees` en `useProjects.ts`

El modal de tickets necesita listar empleados para el selector de asignación. Ya existe `useAllClients` en `useProjects.ts`. Se agrega `useAllEmployees` en ese mismo archivo:

```typescript
import { employeeService } from '../services/employeeService'

export function useAllEmployees() {
  return useQuery({
    queryKey: ['employees-all'],
    queryFn: () => employeeService.getAll({ page: 1, pageSize: 200 }),
    staleTime: 60_000,
  })
}
```

**¿Por qué agregar `useAllEmployees` en `useProjects.ts` y no en `useTickets.ts` o `useEmployees.ts`?**  
`useAllClients` ya vive en `useProjects.ts` y tiene el mismo propósito: cargar una lista completa para un selector de modal. Agregar `useAllEmployees` al mismo archivo sigue el patrón establecido y hace que ambas listas de "selector" estén en el mismo lugar. Si en el futuro más módulos necesitan `useAllEmployees`, se puede mover a un archivo utilitario compartido; por ahora no hay beneficio en adelantarse.

---

### 16. Página `TicketsPage` (`src/pages/TicketsPage.tsx`)

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Tickets                                        [+ Nuevo ticket]     │
│                                                                      │
│  🔍 Buscar por título...   [Estado ▼]   [Prioridad ▼]               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Título               Estado       Prioridad  Asignado  Acc.  │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ Login no funciona    ● Abierto    ● Alta     García   ✏️ 🗑️  │   │
│  │ Error en facturas    ● En progreso ● Crítica  López    ✏️ 🗑️  │   │
│  │ Lentitud en sistema  ● Resuelto   ● Media    —        ✏️ 🗑️  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Página 1 de 2  [←] [1] [2] [→]                                    │
└──────────────────────────────────────────────────────────────────────┘
```

#### Badges de estado y prioridad

Dos conjuntos de badges con colores distintos:

```typescript
// Estado — colores de ciclo de vida (fríos → cálidos → neutro)
const STATUS_CONFIG: Record<TicketStatus, { label: string; className: string }> = {
  Open:       { label: 'Abierto',     className: 'badge-blue'   },
  InProgress: { label: 'En progreso', className: 'badge-purple' },
  Resolved:   { label: 'Resuelto',    className: 'badge-green'  },
  Closed:     { label: 'Cerrado',     className: 'badge-gray'   },
}

// Prioridad — escala de urgencia (verde → amarillo → naranja → rojo)
const PRIORITY_CONFIG: Record<TicketPriority, { label: string; className: string }> = {
  Low:      { label: 'Baja',     className: 'badge-green'  },
  Medium:   { label: 'Media',    className: 'badge-yellow' },
  High:     { label: 'Alta',     className: 'badge-orange' },
  Critical: { label: 'Crítica',  className: 'badge-red'    },
}
```

Los componentes `StatusBadge` y `PriorityBadge` se implementan como funciones internas del mismo archivo.

#### Modal crear / editar

```
┌───────────────────────────────────────┐
│  Nuevo ticket                 [✕]     │
│                                       │
│  Título *                             │
│  ┌─────────────────────────────────┐  │
│  └─────────────────────────────────┘  │
│                                       │
│  Descripción *                        │
│  ┌─────────────────────────────────┐  │
│  │                                 │  │  ← textarea
│  └─────────────────────────────────┘  │
│                                       │
│  Categoría *        Prioridad *       │
│  ┌──────────────┐  ┌──────────────┐   │
│  └──────────────┘  │ Alta       ▼ │   │  ← select con los 4 valores
│                    └──────────────┘   │
│                                       │
│  Estado *           (solo en editar)  │
│  ┌─────────────────────────────────┐  │
│  │ En progreso                   ▼ │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Cliente (opcional)                   │
│  ┌─────────────────────────────────┐  │
│  │ Seleccionar cliente...        ▼ │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Empleado asignado (opcional)         │
│  ┌─────────────────────────────────┐  │
│  │ Seleccionar empleado...       ▼ │  │
│  └─────────────────────────────────┘  │
│                                       │
│  [Cancelar]               [Guardar]   │
└───────────────────────────────────────┘
```

El campo **Estado** solo aparece en modo `edit` — en modo `create` está oculto (siempre es `Open`).

Los selectores de cliente y empleado incluyen una opción vacía `"Sin asignar"` que envía `null` al backend.

#### Estado del componente

```typescript
search: string
debouncedSearch: string
statusFilter: TicketStatus | ''
priorityFilter: TicketPriority | ''
page: number
modal: ModalState
deleteConfirm: DeleteConfirm
```

---

### 17. Estilos nuevos en `index.css`

```css
/* ── Badges adicionales (tickets) ───────────────────────────────────── */
.badge-purple { background: #ede9fe; color: #6d28d9; }
.badge-yellow { background: #fef9c3; color: #854d0e; }
.badge-orange { background: #ffedd5; color: #9a3412; }
```

`badge-blue`, `badge-green`, `badge-gray` y `badge-red` ya existen del módulo de proyectos.

---

### 18. Agregar ruta y navegación

**`App.tsx`:** agregar ruta `/tickets` con `ProtectedRoute`.

**`DashboardPage.tsx`:** agregar botón "Tickets" junto a los botones existentes.

---

## Orden de implementación

1. `TicketPriority.cs` — enum
2. `TicketStatus.cs` — enum
3. `Ticket.cs` — entidad con FKs opcionales
4. `ITicketRepository.cs` — interfaz
5. DTOs (los 5 archivos)
6. `AppDbContext.cs` — `DbSet<Ticket>` + configuración con ambas relaciones opcionales
7. `TicketRepository.cs` — EF Core con doble `Include` y filtros de enum
8. `TicketService.cs` — CRUD + `ChangeStatusAsync`, con recarga post-escritura
9. `Program.cs` — registrar dependencias
10. `TicketsController.cs` — endpoints incluyendo `PATCH .../status`
11. Migración EF Core
12. `ticket.types.ts` — tipos frontend con dos union types
13. `ticketService.ts` — llamadas HTTP incluyendo `patch`
14. `useTickets.ts` — hooks React Query
15. `useProjects.ts` — agregar `useAllEmployees`
16. `TicketsPage.tsx` — UI con dos badges, dos filtros, modal con selectores opcionales
17. `index.css` — agregar `badge-purple`, `badge-yellow`, `badge-orange`
18. `App.tsx` — agregar ruta `/tickets`
19. `DashboardPage.tsx` — agregar botón "Tickets"

---

## Lo que esta spec NO hace

- No implementa transiciones de estado con validación de flujo (ej. no se puede pasar de `Closed` a `Open`) — spec separada si se requiere
- No implementa comentarios o historial de actividad por ticket — spec separada
- No implementa notificaciones al empleado cuando se le asigna un ticket — spec separada
- No implementa adjuntos (archivos) en tickets — spec separada
- No implementa SLA (tiempos de respuesta obligatorios por prioridad) — spec separada
