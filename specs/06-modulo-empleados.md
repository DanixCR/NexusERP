# Spec 06 — Módulo de Empleados

**Estado:** Pendiente de validación  
**Alcance:** Backend (`NexusERP.Core`, `NexusERP.Infrastructure`, `NexusERP.API`) + Frontend (`NexusERP.Client/src/`)  
**Prerequisito:** Spec 04 ejecutada (módulo de clientes operativo; `NotFoundException` y patrón de paginación ya establecidos)

---

## Visión general

Un empleado representa una persona contratada por la empresa. Este módulo introduce dos conceptos nuevos: usar `DateOnly` en lugar de `DateTime` para fechas sin hora, y usar `decimal` para valores monetarios (salario).

```
Employee
  ├── FirstName, LastName, Email, Phone
  ├── Position (puesto), Department (departamento)
  ├── HireDate (fecha de contratación)
  ├── Salary (salario)
  └── IsActive (soft delete)
```

A diferencia del módulo de proyectos, `Employee` no tiene relaciones con otras entidades en esta spec — es una entidad raíz autónoma.

---

## Parte 1 — Backend

### Archivos a crear

```
NexusERP.Core/
├── Entities/
│   └── Employee.cs
├── Interfaces/
│   └── IEmployeeRepository.cs
├── DTOs/
│   └── Employees/
│       ├── CreateEmployeeDto.cs
│       ├── UpdateEmployeeDto.cs
│       ├── EmployeeResponseDto.cs
│       └── EmployeeQueryParams.cs
└── Services/
    └── EmployeeService.cs

NexusERP.Infrastructure/
└── Repositories/
    └── EmployeeRepository.cs

NexusERP.API/
└── Controllers/
    └── EmployeesController.cs
```

### Archivos a modificar

```
NexusERP.Infrastructure/Data/AppDbContext.cs   ← agregar DbSet<Employee> + configuración
NexusERP.API/Program.cs                        ← registrar IEmployeeRepository + EmployeeService
```

---

### 1. Entidad `Employee` (`NexusERP.Core/Entities/Employee.cs`)

```csharp
namespace NexusERP.Core.Entities;

public class Employee
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Position { get; set; } = string.Empty;   // Puesto: "Desarrollador", "Contador", etc.
    public string Department { get; set; } = string.Empty; // Departamento: "IT", "Finanzas", etc.
    public DateOnly HireDate { get; set; }
    public decimal Salary { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**¿Por qué `DateOnly` y no `DateTime` para `HireDate`?**  
Una fecha de contratación no tiene hora — nadie dice "fue contratado el 15 de marzo a las 14:32". `DateTime` guardaría tiempo basura (00:00:00 o la hora actual) que no significa nada. `DateOnly` fue introducido en .NET 6 precisamente para este caso: fechas sin componente de tiempo. EF Core 8+ lo soporta nativamente.

**¿Por qué `decimal` y no `double` para `Salary`?**  
`double` y `float` usan representación binaria en punto flotante, lo que causa errores de redondeo invisibles en operaciones matemáticas: `0.1 + 0.2 == 0.30000000000000004`. Para dinero esto es inaceptable. `decimal` usa representación en base 10 y es exacto hasta 28-29 dígitos significativos. En SQL Server se mapea a `decimal(18,2)` por convención — 18 dígitos totales, 2 decimales.

**¿Por qué `Department` y `Position` como `string` y no como enums o entidades separadas?**  
Los departamentos y puestos de una empresa cambian con el tiempo y varían por organización. Si fueran enums, cada nuevo departamento requeriría un cambio de código y migración. Si fueran entidades con tabla propia, agregarían complejidad (FKs, formularios de ABM de departamentos) sin beneficio para este stage del proyecto. Un string simple es la solución correcta para datos que el usuario escribe libremente. Cuando la empresa crezca y se necesite consistencia (mismo nombre de departamento siempre), se puede migrar a una tabla de catálogos.

---

### 2. Interfaz `IEmployeeRepository` (`NexusERP.Core/Interfaces/IEmployeeRepository.cs`)

```csharp
using NexusERP.Core.DTOs.Employees;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface IEmployeeRepository
{
    Task<Employee?> GetByIdAsync(Guid id);
    Task<Employee?> GetByEmailAsync(string email);
    Task<(IEnumerable<Employee> Items, int TotalCount)> GetPagedAsync(EmployeeQueryParams query);
    Task CreateAsync(Employee employee);
    Task UpdateAsync(Employee employee);
    Task DeleteAsync(Employee employee);
}
```

**¿Por qué `GetByEmailAsync`?**  
El email de un empleado debe ser único dentro del sistema — es el identificador natural de una persona. El servicio necesita verificar unicidad al crear y al editar. Sin este método, el repositorio no tiene forma de buscar por email sin cargar todos los empleados.

---

### 3. DTOs (`NexusERP.Core/DTOs/Employees/`)

#### `CreateEmployeeDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Employees;

public class CreateEmployeeDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Position { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public DateOnly HireDate { get; set; }
    public decimal Salary { get; set; }
}
```

#### `UpdateEmployeeDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Employees;

public class UpdateEmployeeDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Position { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public DateOnly HireDate { get; set; }
    public decimal Salary { get; set; }
}
```

**¿Por qué `CreateEmployeeDto` y `UpdateEmployeeDto` tienen los mismos campos?**  
A diferencia del módulo de proyectos (donde `Status` no podía setearse al crear), todos los campos de un empleado son editables en ambos sentidos. DTOs separados mantienen la puerta abierta para futuras divergencias (ej. `IsActive` podría agregarse solo a Update) sin romper la API.

#### `EmployeeResponseDto.cs`

```csharp
namespace NexusERP.Core.DTOs.Employees;

public class EmployeeResponseDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;  // FirstName + " " + LastName
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Position { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public DateOnly HireDate { get; set; }
    public decimal Salary { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**¿Por qué `FullName` en el DTO de respuesta si FirstName y LastName ya están presentes?**  
El frontend necesita mostrar el nombre completo en la tabla y en el modal. Sin `FullName`, cada componente haría `${employee.firstName} ${employee.lastName}`, duplicando esa lógica en múltiples lugares. Al generarlo una vez en el servicio con `$"{e.FirstName} {e.LastName}"`, el backend es la fuente única de verdad del formato del nombre.

#### `EmployeeQueryParams.cs`

```csharp
namespace NexusERP.Core.DTOs.Employees;

public class EmployeeQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }      // Filtra por nombre (first o last) o puesto
    public string? Department { get; set; }  // Filtra por departamento exacto
}
```

---

### 4. Servicio `EmployeeService` (`NexusERP.Core/Services/EmployeeService.cs`)

```csharp
using NexusERP.Core.DTOs.Employees;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class EmployeeService
{
    private readonly IEmployeeRepository _employeeRepository;

    public EmployeeService(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    public async Task<(IEnumerable<EmployeeResponseDto> Items, int TotalCount)> GetPagedAsync(EmployeeQueryParams query)
    {
        var (items, total) = await _employeeRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<EmployeeResponseDto> GetByIdAsync(Guid id)
    {
        var employee = await _employeeRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Employee {id} not found");

        return MapToDto(employee);
    }

    public async Task<EmployeeResponseDto> CreateAsync(CreateEmployeeDto dto)
    {
        var existing = await _employeeRepository.GetByEmailAsync(dto.Email.Trim().ToLower());
        if (existing is not null)
            throw new ConflictException($"An employee with email '{dto.Email}' already exists");

        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            Email = dto.Email.Trim().ToLower(),
            Phone = dto.Phone?.Trim(),
            Position = dto.Position.Trim(),
            Department = dto.Department.Trim(),
            HireDate = dto.HireDate,
            Salary = dto.Salary,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _employeeRepository.CreateAsync(employee);
        return MapToDto(employee);
    }

    public async Task<EmployeeResponseDto> UpdateAsync(Guid id, UpdateEmployeeDto dto)
    {
        var employee = await _employeeRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Employee {id} not found");

        // Si el email cambió, verificar que no lo tenga otro empleado
        var normalizedEmail = dto.Email.Trim().ToLower();
        if (employee.Email != normalizedEmail)
        {
            var existing = await _employeeRepository.GetByEmailAsync(normalizedEmail);
            if (existing is not null)
                throw new ConflictException($"An employee with email '{dto.Email}' already exists");
        }

        employee.FirstName = dto.FirstName.Trim();
        employee.LastName = dto.LastName.Trim();
        employee.Email = normalizedEmail;
        employee.Phone = dto.Phone?.Trim();
        employee.Position = dto.Position.Trim();
        employee.Department = dto.Department.Trim();
        employee.HireDate = dto.HireDate;
        employee.Salary = dto.Salary;
        employee.UpdatedAt = DateTime.UtcNow;

        await _employeeRepository.UpdateAsync(employee);
        return MapToDto(employee);
    }

    public async Task DeleteAsync(Guid id)
    {
        var employee = await _employeeRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Employee {id} not found");

        await _employeeRepository.DeleteAsync(employee);
    }

    private static EmployeeResponseDto MapToDto(Employee e) => new()
    {
        Id = e.Id,
        FirstName = e.FirstName,
        LastName = e.LastName,
        FullName = $"{e.FirstName} {e.LastName}",
        Email = e.Email,
        Phone = e.Phone,
        Position = e.Position,
        Department = e.Department,
        HireDate = e.HireDate,
        Salary = e.Salary,
        IsActive = e.IsActive,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt
    };
}
```

**¿Por qué normalizar el email a minúsculas (`ToLower`)?**  
Los emails no distinguen mayúsculas de minúsculas (RFC 5321): `JUAN@empresa.com` y `juan@empresa.com` son el mismo buzón. Si se guardara con mayúsculas, un empleado podría registrarse con `Juan@empresa.com` y otro con `juan@empresa.com` pasando la validación de unicidad. Normalizar a minúsculas al guardar y al buscar garantiza unicidad real.

**¿Por qué verificar el email solo si cambió en `UpdateAsync`?**  
Si el email no cambió, `GetByEmailAsync` devolvería al mismo empleado que estamos editando — eso dispararía falso positivo de conflicto. Comparar primero `employee.Email != normalizedEmail` evita la consulta extra y el falso error.

**¿Qué es `ConflictException`?**  
Es una excepción de dominio propia (ya existe el patrón con `NotFoundException`). Representa HTTP 409 Conflict — el recurso no puede crearse porque viola una restricción de unicidad. El middleware global de errores ya existente debe manejarla igual que maneja `NotFoundException`.

---

### 5. Repositorio `EmployeeRepository` (`NexusERP.Infrastructure/Repositories/EmployeeRepository.cs`)

```csharp
using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Employees;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class EmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _context;

    public EmployeeRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Employee?> GetByIdAsync(Guid id)
        => await _context.Employees
            .Where(e => e.IsActive)
            .FirstOrDefaultAsync(e => e.Id == id);

    public async Task<Employee?> GetByEmailAsync(string email)
        => await _context.Employees
            .Where(e => e.IsActive)
            .FirstOrDefaultAsync(e => e.Email == email);

    public async Task<(IEnumerable<Employee> Items, int TotalCount)> GetPagedAsync(EmployeeQueryParams query)
    {
        var q = _context.Employees.Where(e => e.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(e =>
                e.FirstName.ToLower().Contains(search) ||
                e.LastName.ToLower().Contains(search) ||
                e.Position.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.Department))
        {
            var dept = query.Department.Trim().ToLower();
            q = q.Where(e => e.Department.ToLower() == dept);
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderBy(e => e.LastName)
            .ThenBy(e => e.FirstName)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task CreateAsync(Employee employee)
    {
        await _context.Employees.AddAsync(employee);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Employee employee)
    {
        _context.Employees.Update(employee);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Employee employee)
    {
        employee.IsActive = false;
        employee.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
```

**¿Por qué la búsqueda cubre `FirstName`, `LastName` Y `Position`?**  
Un usuario puede buscar "Juan" (nombre), "García" (apellido), o "Contador" (puesto). Los tres son campos de texto que el usuario asocia con un empleado. Limitar la búsqueda solo al nombre obligaría a buscar por puesto con el filtro de departamento, que es menos flexible.

**¿Por qué `OrderBy(LastName).ThenBy(FirstName)` y no por fecha de creación?**  
Los directorios de personas siempre se ordenan alfabéticamente por apellido — es la convención universal en RR.HH. y listas de empleados. Ordenar por fecha de creación mostraría primero a los empleados más antiguos, que es menos útil en una lista de directorio.

**¿Por qué el filtro de departamento usa igualdad exacta (`==`) y no `Contains`?**  
El filtro de departamento viene de un selector (`<select>`) en el frontend — el usuario elige uno de los valores disponibles, no escribe texto libre. Por lo tanto se espera coincidencia exacta. La búsqueda por texto parcial con `Contains` introduciría falsos positivos (ej. buscar departamento "IT" con contains matchearía "Marketing").

---

### 6. Modificar `AppDbContext`

Agregar en `AppDbContext.cs`:

```csharp
// Nueva propiedad:
public DbSet<Employee> Employees => Set<Employee>();

// En OnModelCreating, agregar:
modelBuilder.Entity<Employee>(entity =>
{
    entity.HasKey(e => e.Id);
    entity.Property(e => e.Id).ValueGeneratedNever();
    entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
    entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();
    entity.Property(e => e.Email).HasMaxLength(200).IsRequired();
    entity.HasIndex(e => e.Email).IsUnique();   // Restricción de unicidad a nivel de base de datos
    entity.Property(e => e.Phone).HasMaxLength(30);
    entity.Property(e => e.Position).HasMaxLength(200).IsRequired();
    entity.Property(e => e.Department).HasMaxLength(200).IsRequired();
    entity.Property(e => e.Salary).HasColumnType("decimal(18,2)");
});
```

**¿Por qué `HasIndex(e => e.Email).IsUnique()` además de validar en el servicio?**  
La validación en el servicio con `GetByEmailAsync` protege en condiciones normales. Pero en entornos con múltiples requests concurrentes (dos registros simultáneos del mismo email), la condición de carrera haría que ambos pasen la validación antes de que alguno guarde. El índice único en la base de datos es la garantía final: SQL Server rechaza el segundo INSERT aunque ambos hayan pasado la validación del servicio.

**¿Por qué `decimal(18,2)` para Salary?**  
`decimal(18,2)` significa 18 dígitos totales con 2 decimales — suficiente para representar hasta $9,999,999,999,999,999.99. Es la configuración estándar para campos monetarios en SQL Server. Sin esta anotación, EF Core podría elegir `decimal(18,6)` u otro tipo por defecto.

---

### 7. `EmployeesController` (`NexusERP.API/Controllers/EmployeesController.cs`)

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Employees;
using NexusERP.Core.Services;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly EmployeeService _employeeService;

    public EmployeesController(EmployeeService employeeService)
    {
        _employeeService = employeeService;
    }

    // GET /api/employees?page=1&pageSize=20&search=juan&department=IT
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] EmployeeQueryParams query)
    {
        var (items, total) = await _employeeService.GetPagedAsync(query);
        return Ok(new
        {
            items,
            totalCount = total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling((double)total / query.PageSize)
        });
    }

    // GET /api/employees/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var employee = await _employeeService.GetByIdAsync(id);
        return Ok(employee);
    }

    // POST /api/employees
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeDto dto)
    {
        var employee = await _employeeService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = employee.Id }, employee);
    }

    // PUT /api/employees/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeDto dto)
    {
        var employee = await _employeeService.UpdateAsync(id, dto);
        return Ok(employee);
    }

    // DELETE /api/employees/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _employeeService.DeleteAsync(id);
        return NoContent();
    }
}
```

---

### 8. Modificar `Program.cs`

Agregar en la sección de inyección de dependencias:

```csharp
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
builder.Services.AddScoped<EmployeeService>();
```

---

### 9. `ConflictException` (`NexusERP.Core/Exceptions/ConflictException.cs`)

Si no existe aún, crear:

```csharp
namespace NexusERP.Core.Exceptions;

public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
}
```

Y en el middleware global de manejo de errores, agregar el caso HTTP 409:

```csharp
ConflictException ex => (StatusCodes.Status409Conflict, ex.Message),
```

---

### 10. Migración de base de datos

```bash
dotnet ef migrations add AddEmployeesTable --project NexusERP.Infrastructure --startup-project NexusERP.API
dotnet ef database update --project NexusERP.Infrastructure --startup-project NexusERP.API
```

---

## Parte 2 — Frontend

### Archivos a crear

```
src/
├── types/
│   └── employee.types.ts
├── services/
│   └── employeeService.ts
├── hooks/
│   └── useEmployees.ts
└── pages/
    └── EmployeesPage.tsx
```

---

### 11. Tipos (`src/types/employee.types.ts`)

```typescript
export type Employee = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  position: string
  department: string
  hireDate: string       // ISO date: "2024-03-15"
  salary: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateEmployeeRequest = {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  position: string
  department: string
  hireDate: string       // ISO date: "yyyy-MM-dd"
  salary: number
}

export type UpdateEmployeeRequest = CreateEmployeeRequest

export type EmployeeQueryParams = {
  page?: number
  pageSize?: number
  search?: string
  department?: string
}
```

**¿Por qué `hireDate` como `string` y no como `Date`?**  
En TypeScript/JavaScript, el tipo `Date` incluye zona horaria e información de hora. Cuando se envía al backend, puede convertirse incorrectamente (ej. el 15 de marzo a medianoche UTC puede volverse el 14 de marzo en timezones UTC-). Usar `string` en formato `"yyyy-MM-dd"` es exacto y no tiene ambigüedad de zona horaria. El input `type="date"` devuelve exactamente este formato.

---

### 12. Servicio (`src/services/employeeService.ts`)

```typescript
import { apiClient } from '../lib/axios'
import type { Employee, CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeQueryParams } from '../types/employee.types'
import type { PagedResponse } from '../types/client.types'

export const employeeService = {
  getAll(params?: EmployeeQueryParams): Promise<PagedResponse<Employee>> {
    return apiClient.get<PagedResponse<Employee>>('/employees', { params }).then(r => r.data)
  },

  getById(id: string): Promise<Employee> {
    return apiClient.get<Employee>(`/employees/${id}`).then(r => r.data)
  },

  create(data: CreateEmployeeRequest): Promise<Employee> {
    return apiClient.post<Employee>('/employees', data).then(r => r.data)
  },

  update(id: string, data: UpdateEmployeeRequest): Promise<Employee> {
    return apiClient.put<Employee>(`/employees/${id}`, data).then(r => r.data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/employees/${id}`).then(() => undefined)
  },
}
```

---

### 13. Hooks React Query (`src/hooks/useEmployees.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../services/employeeService'
import type { CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeQueryParams } from '../types/employee.types'

export function useEmployees(params?: EmployeeQueryParams) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => employeeService.getAll(params),
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEmployeeRequest) => employeeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeRequest }) =>
      employeeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => employeeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
```

---

### 14. Página `EmployeesPage` (`src/pages/EmployeesPage.tsx`)

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Empleados                                  [+ Nuevo empleado]  │
│                                                                 │
│  🔍 Buscar por nombre o puesto...   [Departamento ▼]           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Nombre          Puesto        Departamento  Salario  ✏️🗑│   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ García, Juan    Desarrollador IT            $45,000  ✏️🗑│   │
│  │ López, María    Contadora     Finanzas      $38,000  ✏️🗑│   │
│  │ Torres, Carlos  Gerente       Ventas        $60,000  ✏️🗑│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Página 1 de 2  [←] [1] [2] [→]                               │
└─────────────────────────────────────────────────────────────────┘
```

El nombre en tabla se muestra como `Apellido, Nombre` — convención de directorios de personas. El modal muestra campos separados para nombre y apellido.

#### Modal crear / editar

```
┌─────────────────────────────────────┐
│  Nuevo empleado             [✕]     │
│                                     │
│  Nombre *           Apellido *      │
│  ┌─────────────┐  ┌──────────────┐  │
│  └─────────────┘  └──────────────┘  │
│                                     │
│  Email *                            │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  Teléfono (opcional)                │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│                                     │
│  Puesto *           Departamento *  │
│  ┌─────────────┐  ┌──────────────┐  │
│  └─────────────┘  └──────────────┘  │
│                                     │
│  Fecha de contratación *            │
│  ┌─────────────────────────────┐    │
│  │ dd/mm/aaaa                  │    │  ← input type="date"
│  └─────────────────────────────┘    │
│                                     │
│  Salario *                          │
│  ┌─────────────────────────────┐    │
│  │ $                           │    │  ← input type="number", min="0", step="0.01"
│  └─────────────────────────────┘    │
│                                     │
│  [Cancelar]             [Guardar]   │
└─────────────────────────────────────┘
```

#### Estado del componente

```typescript
search: string
debouncedSearch: string
departmentFilter: string   // '' = todos, o nombre exacto del departamento
page: number
modal: ModalState          // { open: boolean; mode: 'create' | 'edit'; employee: Employee | null }
deleteConfirm: DeleteConfirm
```

#### Selector de departamento

El selector se construye dinámicamente a partir de los empleados cargados — no viene de un endpoint separado. Se extrae la lista de departamentos únicos de los resultados actuales:

```typescript
const departments = [...new Set(employees.map(e => e.department))].sort()
```

**¿Por qué no un endpoint `/api/employees/departments`?**  
Para este stage del proyecto, extraer los departamentos del cliente es suficiente y evita complejidad extra. La limitación es que solo muestra departamentos de la página actual. Si hubiera miles de empleados y se necesitara filtrar por un departamento que no aparece en la primera página, se agregaría el endpoint. El usuario puede buscar por texto mientras tanto.

#### Formato de salario en tabla

```typescript
const formatSalary = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
```

**¿Por qué `Intl.NumberFormat` y no `$${amount.toFixed(2)}`?**  
`Intl.NumberFormat` es la API nativa del navegador para formatear números. Con `en-US` y `currency: 'USD'` formatea `45000` como `$45,000.00` — separador de miles con coma y dos decimales. Hardcodear `$${amount.toFixed(2)}` no manejaría los separadores de miles, produciendo `$45000.00` que es menos legible.

---

### 15. Agregar ruta y navegación

**`App.tsx`:** agregar ruta `/employees` con `ProtectedRoute`.

**`DashboardPage.tsx`:** agregar botón "Empleados" junto a los botones "Clientes" y "Proyectos" existentes.

---

## Orden de implementación

1. `Employee.cs` — entidad
2. `IEmployeeRepository.cs` — interfaz
3. DTOs (los 4 archivos)
4. `ConflictException.cs` — si no existe; agregar caso en middleware de errores
5. `AppDbContext.cs` — `DbSet<Employee>` + configuración + índice único en email
6. `EmployeeRepository.cs` — EF Core con filtros y ordenamiento
7. `EmployeeService.cs` — lógica de negocio con validación de email
8. `Program.cs` — registrar dependencias
9. `EmployeesController.cs` — endpoints
10. Migración EF Core
11. `employee.types.ts` — tipos frontend
12. `employeeService.ts` — llamadas HTTP
13. `useEmployees.ts` — hooks React Query
14. `EmployeesPage.tsx` — UI completa
15. `App.tsx` — agregar ruta `/employees`
16. `DashboardPage.tsx` — agregar botón "Empleados"

---

## Lo que esta spec NO hace

- No implementa asignación de empleados a proyectos — spec de relación Proyecto-Empleado
- No implementa roles o permisos dentro del ERP — spec de módulo de permisos
- No implementa historial de cambios de salario — spec separada
- No implementa carga de foto de perfil — spec separada
- No implementa exportación a PDF/Excel del directorio de empleados — spec separada
