# Spec 05 — Módulo de Proyectos

**Estado:** Pendiente de validación  
**Alcance:** Backend (`NexusERP.Core`, `NexusERP.Infrastructure`, `NexusERP.API`) + Frontend (`NexusERP.Client/src/`)  
**Prerequisito:** Spec 04 ejecutada (módulo de clientes operativo, tabla `Clients` en SQL Server)

---

## Visión general

Un proyecto representa un trabajo o encargo que un cliente le da a la empresa. Cada proyecto pertenece a exactamente un cliente, tiene un estado que cambia a lo largo del tiempo, y fechas opcionales de inicio y vencimiento. Este módulo introduce el primer concepto de **relación entre entidades** (Client → Project) y el uso de **enums** en C# y TypeScript.

```
Client (1) ──────────── (N) Project
  │                           │
  │  Un cliente puede tener   │  Un proyecto pertenece
  │  muchos proyectos         │  a un solo cliente
```

---

## Parte 1 — Backend

### Archivos a crear

```
NexusERP.Core/
├── Entities/
│   ├── Project.cs
│   └── ProjectStatus.cs          ← enum
├── Interfaces/
│   └── IProjectRepository.cs
├── DTOs/
│   └── Projects/
│       ├── CreateProjectDto.cs
│       ├── UpdateProjectDto.cs
│       ├── ProjectResponseDto.cs
│       └── ProjectQueryParams.cs
└── Services/
    └── ProjectService.cs

NexusERP.Infrastructure/
└── Repositories/
    └── ProjectRepository.cs

NexusERP.API/
└── Controllers/
    └── ProjectsController.cs
```

### Archivos a modificar

```
NexusERP.Infrastructure/Data/AppDbContext.cs   ← agregar DbSet<Project> + configuración
NexusERP.API/Program.cs                        ← registrar IProjectRepository + ProjectService
```

---

### 1. Enum `ProjectStatus` (`NexusERP.Core/Entities/ProjectStatus.cs`)

```csharp
namespace NexusERP.Core.Entities;

public enum ProjectStatus
{
    Pending,      // Pendiente — creado pero no iniciado
    InProgress,   // En progreso — trabajo activo
    Completed,    // Completado — entregado y cerrado
    Cancelled     // Cancelado — no se continuará
}
```

**¿Por qué un enum y no una tabla de estados?**  
Los estados de un proyecto son un conjunto fijo y conocido — no van a crecer dinámicamente como lo harían, por ejemplo, las categorías de productos. Un enum en C# da autocompletado, detección de errores en tiempo de compilación, y evita que lleguen valores inválidos. Una tabla de estados en la base de datos agregaría complejidad sin beneficio real para un conjunto cerrado de valores.

**¿Cómo se persiste el enum en SQL Server?**  
EF Core convierte el enum a `string` usando `.HasConversion<string>()` en la configuración del modelo. Esto guarda `"Pending"`, `"InProgress"`, etc. en lugar de `0`, `1`, `2`. Las strings son mucho más legibles en consultas SQL directas y resistentes a errores si se reordena el enum.

---

### 2. Entidad `Project` (`NexusERP.Core/Entities/Project.cs`)

```csharp
namespace NexusERP.Core.Entities;

public class Project
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProjectStatus Status { get; set; }
    public DateTime? StartDate { get; set; }    // Nullable — puede no definirse al crear
    public DateTime? DueDate { get; set; }      // Nullable — puede no tener fecha límite
    public Guid ClientId { get; set; }          // Foreign key
    public Client Client { get; set; } = null!; // Navigation property
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**¿Qué es una navigation property (`Client`)?**  
En EF Core, las navigation properties son referencias a entidades relacionadas. Cuando se hace una consulta con `.Include(p => p.Client)`, EF Core hace el JOIN automáticamente y llena esa propiedad. Sin ella, `p.Client` sería `null` aunque el `ClientId` exista en la base de datos.

El `null!` (null-forgiving operator) le dice al compilador "sé que esto parece nullable pero no lo será en runtime, confía en mí". EF Core siempre lo llenará al cargar la entidad con `Include`.

**¿Por qué `StartDate` y `DueDate` son nullable?**  
Al crear un proyecto no siempre se conocen las fechas. Forzarlas generaría datos inventados. Es mejor modelar la realidad: un proyecto puede existir sin fechas definidas.

---

### 3. Interfaz `IProjectRepository` (`NexusERP.Core/Interfaces/IProjectRepository.cs`)

```csharp
using NexusERP.Core.DTOs.Projects;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id);
    Task<(IEnumerable<Project> Items, int TotalCount)> GetPagedAsync(ProjectQueryParams query);
    Task CreateAsync(Project project);
    Task UpdateAsync(Project project);
    Task DeleteAsync(Project project);
}
```

A diferencia de `IClientRepository`, no hay `GetByTaxIdAsync` porque los proyectos no tienen un campo de unicidad de negocio — dos proyectos con el mismo nombre para el mismo cliente son válidos.

---

### 4. DTOs (`NexusERP.Core/DTOs/Projects/`)

#### `CreateProjectDto.cs`
```csharp
namespace NexusERP.Core.DTOs.Projects;

public class CreateProjectDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid ClientId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    // Status no está aquí: un proyecto siempre empieza como Pending
}
```

**¿Por qué `Status` no está en `CreateProjectDto`?**  
Un proyecto recién creado siempre comienza en estado `Pending`. Permitir que el cliente HTTP elija el estado inicial abriría la puerta a crear proyectos directamente en `Completed` o `Cancelled`, lo cual no tiene sentido de negocio. El servicio asigna `Pending` internamente.

#### `UpdateProjectDto.cs`
```csharp
namespace NexusERP.Core.DTOs.Projects;

public class UpdateProjectDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid ClientId { get; set; }
    public ProjectStatus Status { get; set; }  // Aquí sí — se puede cambiar el estado al editar
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
}
```

#### `ProjectResponseDto.cs`
```csharp
namespace NexusERP.Core.DTOs.Projects;

public class ProjectResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;   // String del enum: "Pending", "InProgress", etc.
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public Guid ClientId { get; set; }
    public string ClientName { get; set; } = string.Empty;  // Nombre del cliente incluido
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**¿Por qué `Status` es `string` en el DTO de respuesta si es `ProjectStatus` en la entidad?**  
Al serializar el DTO a JSON, un `string` produce `"InProgress"` mientras que un `enum` produce `2` (el número entero). El frontend recibe `"InProgress"` en lugar de `2`, que es mucho más legible y no depende del orden del enum. Esta conversión se hace en el `MapToDto` del servicio con `c.Status.ToString()`.

**¿Por qué `ClientName` en el DTO de respuesta?**  
El frontend necesita mostrar el nombre del cliente en la tabla de proyectos. Sin `ClientName`, tendría que hacer una llamada separada por cada proyecto para obtener el nombre (N+1 queries). Al incluirlo en el DTO, el backend hace un solo JOIN y el frontend recibe todo en un request.

#### `ProjectQueryParams.cs`
```csharp
namespace NexusERP.Core.DTOs.Projects;

public class ProjectQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }              // Filtra por nombre o descripción
    public string? Status { get; set; }              // Filtra por estado ("Pending", etc.)
    public Guid? ClientId { get; set; }              // Filtra por cliente específico
}
```

**¿Por qué `Status` es `string?` y no `ProjectStatus?` en los query params?**  
Cuando el filtro llega como query string (`?status=InProgress`), ASP.NET Core puede no parsearlo automáticamente a un enum si el valor no coincide exactamente. Usarlo como `string?` y convertirlo manualmente en el repositorio es más robusto: si el valor es inválido, simplemente se ignora el filtro en lugar de devolver un error 400.

---

### 5. Servicio `ProjectService` (`NexusERP.Core/Services/ProjectService.cs`)

```csharp
using NexusERP.Core.DTOs.Projects;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class ProjectService
{
    private readonly IProjectRepository _projectRepository;
    private readonly IClientRepository _clientRepository;

    public ProjectService(IProjectRepository projectRepository, IClientRepository clientRepository)
    {
        _projectRepository = projectRepository;
        _clientRepository = clientRepository;
    }

    public async Task<(IEnumerable<ProjectResponseDto> Items, int TotalCount)> GetPagedAsync(ProjectQueryParams query)
    {
        var (items, total) = await _projectRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<ProjectResponseDto> GetByIdAsync(Guid id)
    {
        var project = await _projectRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Project {id} not found");

        return MapToDto(project);
    }

    public async Task<ProjectResponseDto> CreateAsync(CreateProjectDto dto)
    {
        // Verificar que el cliente existe y está activo antes de crear el proyecto
        var client = await _clientRepository.GetByIdAsync(dto.ClientId)
            ?? throw new NotFoundException($"Client {dto.ClientId} not found");

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            Status = ProjectStatus.Pending,   // Siempre empieza en Pending
            StartDate = dto.StartDate,
            DueDate = dto.DueDate,
            ClientId = client.Id,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _projectRepository.CreateAsync(project);

        // El proyecto recién creado no tiene la navigation property Client cargada.
        // En lugar de recargar desde la base de datos, asignamos manualmente para
        // que MapToDto pueda acceder a client.Name.
        project.Client = client;

        return MapToDto(project);
    }

    public async Task<ProjectResponseDto> UpdateAsync(Guid id, UpdateProjectDto dto)
    {
        var project = await _projectRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Project {id} not found");

        // Si el cliente cambió, verificar que el nuevo cliente existe
        if (project.ClientId != dto.ClientId)
        {
            var client = await _clientRepository.GetByIdAsync(dto.ClientId)
                ?? throw new NotFoundException($"Client {dto.ClientId} not found");
        }

        project.Name = dto.Name.Trim();
        project.Description = dto.Description?.Trim();
        project.Status = dto.Status;
        project.StartDate = dto.StartDate;
        project.DueDate = dto.DueDate;
        project.ClientId = dto.ClientId;
        project.UpdatedAt = DateTime.UtcNow;

        await _projectRepository.UpdateAsync(project);
        return MapToDto(project);
    }

    public async Task DeleteAsync(Guid id)
    {
        var project = await _projectRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Project {id} not found");

        await _projectRepository.DeleteAsync(project);
    }

    private static ProjectResponseDto MapToDto(Project p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Status = p.Status.ToString(),
        StartDate = p.StartDate,
        DueDate = p.DueDate,
        ClientId = p.ClientId,
        ClientName = p.Client.Name,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}
```

**¿Por qué `ProjectService` depende de `IClientRepository`?**  
Al crear o actualizar un proyecto, el servicio necesita verificar que el `ClientId` proporcionado corresponde a un cliente activo. Sin esta validación, se podría crear un proyecto apuntando a un cliente inexistente o eliminado, corrompiendo los datos. `ProjectService` no tiene acceso directo a la base de datos — la única forma correcta de consultar clientes es a través de `IClientRepository`.

**¿Por qué asignar `project.Client = client` después de crear?**  
Cuando EF Core hace el `AddAsync` y `SaveChangesAsync`, el objeto en memoria no tiene la navigation property `Client` cargada (solo tiene `ClientId`). El `MapToDto` accede a `p.Client.Name`, lo que causaría una `NullReferenceException`. Asignar `project.Client = client` después del guardado evita hacer una consulta extra a la base de datos para recargar la entidad.

---

### 6. Repositorio `ProjectRepository` (`NexusERP.Infrastructure/Repositories/ProjectRepository.cs`)

```csharp
using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Projects;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class ProjectRepository : IProjectRepository
{
    private readonly AppDbContext _context;

    public ProjectRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Project?> GetByIdAsync(Guid id)
        => await _context.Projects
            .Include(p => p.Client)
            .Where(p => p.IsActive)
            .FirstOrDefaultAsync(p => p.Id == id);

    public async Task<(IEnumerable<Project> Items, int TotalCount)> GetPagedAsync(ProjectQueryParams query)
    {
        var q = _context.Projects
            .Include(p => p.Client)
            .Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(p =>
                p.Name.ToLower().Contains(search) ||
                (p.Description != null && p.Description.ToLower().Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(query.Status) &&
            Enum.TryParse<ProjectStatus>(query.Status, ignoreCase: true, out var status))
        {
            q = q.Where(p => p.Status == status);
        }

        if (query.ClientId.HasValue)
        {
            q = q.Where(p => p.ClientId == query.ClientId.Value);
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderByDescending(p => p.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task CreateAsync(Project project)
    {
        await _context.Projects.AddAsync(project);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Project project)
    {
        _context.Projects.Update(project);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Project project)
    {
        project.IsActive = false;
        project.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
```

**¿Por qué `.Include(p => p.Client)` en todas las consultas?**  
`MapToDto` accede a `p.Client.Name`. Sin el `Include`, EF Core no carga la navigation property y `p.Client` sería `null` → `NullReferenceException` en runtime. El `Include` instruye a EF Core a hacer un `LEFT JOIN` automáticamente con la tabla `Clients`.

**¿Por qué `OrderByDescending(p => p.CreatedAt)` y no por nombre como en clientes?**  
Los proyectos son más útiles ordenados del más reciente al más antiguo — el usuario típicamente quiere ver primero los proyectos activos recientes, no los terminados hace años. Los clientes, en cambio, se ordenan por nombre porque se buscan por nombre frecuentemente.

**¿Por qué `Enum.TryParse` para el filtro de status?**  
`Enum.TryParse` intenta convertir el string `"InProgress"` al valor de enum `ProjectStatus.InProgress`. Si el string no es válido (ej. `"hola"`), devuelve `false` y el `if` simplemente no aplica el filtro, en lugar de devolver un error. Es la forma defensiva de manejar input potencialmente inválido en query params.

---

### 7. Modificar `AppDbContext`

Agregar `DbSet` y la configuración de la entidad en `OnModelCreating`:

```csharp
// Nueva propiedad:
public DbSet<Project> Projects => Set<Project>();

// En OnModelCreating, agregar después de la configuración de Client:
modelBuilder.Entity<Project>(entity =>
{
    entity.HasKey(p => p.Id);
    entity.Property(p => p.Id).ValueGeneratedNever();
    entity.Property(p => p.Name).HasMaxLength(300).IsRequired();
    entity.Property(p => p.Description).HasMaxLength(2000);
    entity.Property(p => p.Status)
          .HasConversion<string>()    // Guarda "Pending", "InProgress", etc. — no números
          .HasMaxLength(30)
          .IsRequired();
    entity.HasOne(p => p.Client)
          .WithMany()                  // Client no necesita navigation property hacia Projects
          .HasForeignKey(p => p.ClientId)
          .OnDelete(DeleteBehavior.Restrict); // Protege contra borrado físico accidental de clientes con proyectos
});
```

**¿Por qué `DeleteBehavior.Restrict` y no `Cascade`?**  
`Cascade` borraría físicamente todos los proyectos si un cliente fuera borrado físicamente. Como usamos soft delete, esto no debería pasar, pero `Restrict` es la red de seguridad: si alguien ejecuta un `DELETE` directo en SQL, SQL Server no lo permitirá si el cliente tiene proyectos. `Cascade` podría borrar datos silenciosamente.

**¿Por qué `WithMany()` sin navigation property en `Client`?**  
No se modifica la entidad `Client` existente. EF Core puede configurar la relación sin navigation property en el lado "uno" — solo necesita la FK (`ClientId`) y la navigation del lado "muchos" (`Project.Client`). Agregar `List<Project> Projects` a `Client` solo sería útil si se quisiera cargar proyectos desde un cliente, lo cual no es necesario en este módulo.

---

### 8. `ProjectsController` (`NexusERP.API/Controllers/ProjectsController.cs`)

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Projects;
using NexusERP.Core.Services;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController : ControllerBase
{
    private readonly ProjectService _projectService;

    public ProjectsController(ProjectService projectService)
    {
        _projectService = projectService;
    }

    // GET /api/projects?page=1&pageSize=20&search=abc&status=InProgress&clientId=...
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ProjectQueryParams query)
    {
        var (items, total) = await _projectService.GetPagedAsync(query);
        return Ok(new
        {
            items,
            totalCount = total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling((double)total / query.PageSize)
        });
    }

    // GET /api/projects/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var project = await _projectService.GetByIdAsync(id);
        return Ok(project);
    }

    // POST /api/projects
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectDto dto)
    {
        var project = await _projectService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    // PUT /api/projects/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectDto dto)
    {
        var project = await _projectService.UpdateAsync(id, dto);
        return Ok(project);
    }

    // DELETE /api/projects/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _projectService.DeleteAsync(id);
        return NoContent();
    }
}
```

---

### 9. Modificar `Program.cs`

Agregar en la sección de inyección de dependencias:

```csharp
builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<ProjectService>();
```

---

### 10. Migración de base de datos

```bash
dotnet ef migrations add AddProjectsTable --project NexusERP.Infrastructure --startup-project NexusERP.API
dotnet ef database update --project NexusERP.Infrastructure --startup-project NexusERP.API
```

---

## Parte 2 — Frontend

### Archivos a crear

```
src/
├── types/
│   └── project.types.ts
├── services/
│   └── projectService.ts
├── hooks/
│   └── useProjects.ts
└── pages/
    └── ProjectsPage.tsx
```

---

### 11. Tipos (`src/types/project.types.ts`)

```typescript
// Los valores del enum deben coincidir exactamente con los strings del backend
export type ProjectStatus = 'Pending' | 'InProgress' | 'Completed' | 'Cancelled'

export type Project = {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  startDate: string | null   // ISO 8601 o null
  dueDate: string | null
  clientId: string
  clientName: string
  createdAt: string
  updatedAt: string
}

export type CreateProjectRequest = {
  name: string
  description: string | null
  clientId: string
  startDate: string | null
  dueDate: string | null
  // status no va aquí: siempre Pending al crear
}

export type UpdateProjectRequest = {
  name: string
  description: string | null
  clientId: string
  status: ProjectStatus
  startDate: string | null
  dueDate: string | null
}

export type ProjectQueryParams = {
  page?: number
  pageSize?: number
  search?: string
  status?: ProjectStatus
  clientId?: string
}
```

**¿Por qué `ProjectStatus` como union type y no como enum de TypeScript?**  
Los enums de TypeScript generan código JavaScript en tiempo de ejecución. Los union types (`'Pending' | 'InProgress' | ...`) son solo para TypeScript — no generan código, son más livianos, y se integran naturalmente con JSON. Un `enum` de TypeScript produciría `ProjectStatus.InProgress` en el código, mientras que el union type permite usar directamente `'InProgress'`, que es lo que espera el backend.

---

### 12. Servicio (`src/services/projectService.ts`)

```typescript
import { apiClient } from '../lib/axios'
import type { Project, CreateProjectRequest, UpdateProjectRequest, ProjectQueryParams } from '../types/project.types'
import type { PagedResponse } from '../types/client.types'

export const projectService = {
  getAll(params?: ProjectQueryParams): Promise<PagedResponse<Project>> {
    return apiClient.get<PagedResponse<Project>>('/projects', { params }).then(r => r.data)
  },

  getById(id: string): Promise<Project> {
    return apiClient.get<Project>(`/projects/${id}`).then(r => r.data)
  },

  create(data: CreateProjectRequest): Promise<Project> {
    return apiClient.post<Project>('/projects', data).then(r => r.data)
  },

  update(id: string, data: UpdateProjectRequest): Promise<Project> {
    return apiClient.put<Project>(`/projects/${id}`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/projects/${id}`).then(() => undefined)
  },
}
```

Nota: `PagedResponse<T>` se importa desde `client.types` — ya está definido y es genérico.

---

### 13. Hooks React Query (`src/hooks/useProjects.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectService } from '../services/projectService'
import { clientService } from '../services/clientService'
import type { CreateProjectRequest, UpdateProjectRequest, ProjectQueryParams } from '../types/project.types'

export function useProjects(params?: ProjectQueryParams) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => projectService.getAll(params),
  })
}

// Carga todos los clientes activos para el selector del modal.
// pageSize=200 es suficiente para este stage del proyecto.
// Si la empresa crece a miles de clientes, se reemplaza por un autocomplete con búsqueda.
export function useAllClients() {
  return useQuery({
    queryKey: ['clients-all'],
    queryFn: () => clientService.getAll({ page: 1, pageSize: 200 }),
    staleTime: 60_000, // Cachear por 1 minuto — los clientes no cambian tan frecuente
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectRequest) => projectService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) =>
      projectService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
```

**¿Por qué `staleTime: 60_000` en `useAllClients`?**  
Sin `staleTime`, React Query refetchea los datos cada vez que el componente se monta. La lista de clientes se usa en el modal — si el usuario abre y cierra el modal varias veces, se dispararían muchos requests innecesarios. Con `staleTime: 60_000`, los datos del caché se consideran frescos por 60 segundos, y solo se refetchean cuando ese tiempo vence.

---

### 14. Página `ProjectsPage` (`src/pages/ProjectsPage.tsx`)

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Proyectos                                  [+ Nuevo proyecto]  │
│                                                                 │
│  🔍 Buscar...   [Estado ▼]   [Cliente ▼]                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Nombre        Cliente    Estado       Fechas   Acciones │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Website       Acme Corp  ● En progreso  —       ✏️ 🗑️  │   │
│  │ App móvil     Beta SRL   ● Pendiente   Vence 30/6 ✏️ 🗑️│   │
│  │ Migración     Acme Corp  ● Completado   —       ✏️ 🗑️  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Página 1 de 2  [←] [1] [2] [→]                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Indicador visual de estado (`StatusBadge`)

Componente interno que renderiza un badge de color según el estado:

```
Pending    → fondo gris     texto "Pendiente"
InProgress → fondo azul     texto "En progreso"
Completed  → fondo verde    texto "Completado"
Cancelled  → fondo rojo     texto "Cancelado"
```

Se implementa como función pura dentro del mismo archivo (no necesita ser un archivo separado):

```typescript
const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  Pending:    { label: 'Pendiente',    className: 'badge-gray'  },
  InProgress: { label: 'En progreso', className: 'badge-blue'  },
  Completed:  { label: 'Completado',  className: 'badge-green' },
  Cancelled:  { label: 'Cancelado',   className: 'badge-red'   },
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = STATUS_CONFIG[status]
  return <span className={`status-badge ${className}`}>{label}</span>
}
```

#### Estado del componente

```typescript
search: string
debouncedSearch: string
statusFilter: ProjectStatus | ''    // '' = todos los estados
clientFilter: string                // '' = todos los clientes, o un clientId
page: number
modal: ModalState
deleteConfirm: DeleteConfirm
```

#### Modal crear / editar

```
┌─────────────────────────────────────┐
│  Nuevo proyecto             [✕]     │
│                                     │
│  Nombre *                           │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  Descripción (opcional)             │
│  ┌─────────────────────────────┐    │
│  │                             │    │  ← textarea, no input
│  └─────────────────────────────┘    │
│                                     │
│  Cliente *                          │
│  ┌─────────────────────────────┐    │
│  │ Seleccionar cliente...    ▼ │    │  ← select con lista de clientes
│  └─────────────────────────────┘    │
│                                     │
│  Estado *          (solo en editar) │
│  ┌─────────────────────────────┐    │
│  │ En progreso               ▼ │    │
│  └─────────────────────────────┘    │
│                                     │
│  Fecha inicio          Fecha límite │
│  ┌──────────────┐  ┌──────────────┐ │
│  │ dd/mm/aaaa   │  │ dd/mm/aaaa   │ │  ← input type="date"
│  └──────────────┘  └──────────────┘ │
│                                     │
│  [Cancelar]             [Guardar]   │
└─────────────────────────────────────┘
```

El campo **Estado** solo aparece en modo `edit` — en modo `create` está oculto porque siempre es `Pending`.

#### Comportamiento de filtros

```
- statusFilter: select con opciones "Todos", "Pendiente", "En progreso", "Completado", "Cancelado"
  → Al cambiar: actualiza statusFilter, resetea page a 1
  
- clientFilter: select cargado desde useAllClients, con opción "Todos los clientes"
  → Al cambiar: actualiza clientFilter, resetea page a 1

- search: input de texto con debounce de 300ms
  → Al cambiar: actualiza debouncedSearch, resetea page a 1

Los tres filtros se aplican combinados (AND) — se envían como query params al API.
```

---

### 15. Agregar ruta y navegación

**`App.tsx`:** agregar ruta `/projects` con `ProtectedRoute`.

**`DashboardPage.tsx`:** agregar botón "Proyectos" junto al botón "Clientes" existente.

---

### 16. Estilos nuevos en `index.css`

Agregar los estilos para los badges de estado:

```css
/* ── Status badges ──────────────────────────────────────────────────────── */
.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.badge-gray  { background: #e5e7eb; color: #374151; }
.badge-blue  { background: #dbeafe; color: #1d4ed8; }
.badge-green { background: #dcfce7; color: #15803d; }
.badge-red   { background: #fee2e2; color: #dc2626; }
```

**¿Por qué colores distintos para cada estado?**  
El color permite escanear visualmente una tabla larga y distinguir proyectos activos de terminados o cancelados sin leer cada texto. Es un patrón de UX estándar en herramientas de gestión (Jira, Linear, Trello).

---

## Orden de implementación

1. `ProjectStatus.cs` — enum
2. `Project.cs` — entidad
3. `IProjectRepository.cs` — interfaz
4. DTOs (los 4 archivos)
5. `AppDbContext.cs` — `DbSet<Project>` + configuración + relación
6. `ProjectRepository.cs` — EF Core con `Include` y filtros
7. `ProjectService.cs` — lógica de negocio
8. `Program.cs` — registrar dependencias
9. `ProjectsController.cs` — endpoints
10. Migración EF Core
11. `project.types.ts` — tipos frontend
12. `projectService.ts` — llamadas HTTP
13. `useProjects.ts` — hooks React Query
14. `ProjectsPage.tsx` — UI completa con badges y filtros
15. `App.tsx` — agregar ruta `/projects`
16. `DashboardPage.tsx` — agregar botón "Proyectos"
17. `index.css` — estilos de badges

---

## Lo que esta spec NO hace

- No implementa cambio de estado mediante drag-and-drop estilo Kanban — spec separada
- No implementa tareas dentro de proyectos (`Task` o `ProjectTask`) — spec separada
- No implementa asignación de usuarios a proyectos — spec de módulo de usuarios
- No implementa notificaciones al vencer `DueDate` — spec separada
- No implementa exportación a PDF — spec separada
