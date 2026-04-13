# Spec 01 — Estructura de Carpetas del Backend

**Estado:** Ejecutado  
**Alcance:** Los tres proyectos backend (`NexusERP.Core`, `NexusERP.Infrastructure`, `NexusERP.API`)  
**Prerequisito:** Ninguno — esta es la base sobre la que se construye todo lo demás

---

## Contexto y motivación

El proyecto fue creado con las plantillas de Visual Studio, que generan archivos placeholder vacíos (`Class1.cs`, `WeatherForecastController.cs`, `WeatherForecast.cs`) que no tienen utilidad en una arquitectura real. Antes de escribir cualquier código de negocio, necesitamos establecer la estructura de carpetas que refleje los principios de **Clean Architecture**.

La estructura de carpetas no es cosmética: define qué depende de qué, dónde vive cada responsabilidad, y cómo se navega el proyecto a medida que crece.

---

## Cambios a ejecutar

### 1. Eliminar archivos placeholder

Estos archivos fueron generados automáticamente por las plantillas y no deben existir en el proyecto final:

| Archivo | Motivo de eliminación |
|---|---|
| `NexusERP.Core/Class1.cs` | Placeholder vacío sin propósito |
| `NexusERP.Infrastructure/Class1.cs` | Placeholder vacío sin propósito |
| `NexusERP.API/WeatherForecast.cs` | Modelo de ejemplo del template |
| `NexusERP.API/Controllers/WeatherForecastController.cs` | Controller de ejemplo del template |

> `NexusERP.API/NexusERP.API.http` puede eliminarse también — es un archivo de pruebas HTTP del IDE que reemplazaremos con herramientas propias.

---

### 2. Crear estructura de carpetas en NexusERP.Core

**Core es el núcleo del sistema.** No depende de ningún otro proyecto. Contiene únicamente lógica de negocio pura, expresada en C# sin referencias a frameworks externos.

```
NexusERP.Core/
├── Entities/
├── Interfaces/
├── DTOs/
├── Services/
└── Exceptions/
```

#### `Entities/`
Las clases que representan los conceptos del negocio. Son los objetos más importantes del sistema.

- **¿Qué van aquí?** `User`, `Product`, `Invoice`, `Customer`, etc.
- **Regla:** No tienen referencias a EF Core, HTTP, ni ningún framework. Son POCO puro (Plain Old CLR Objects).
- **¿Por qué existen?** Porque el negocio existe independientemente de la tecnología. Un `Invoice` tiene las mismas reglas de negocio si la base de datos es SQL Server, PostgreSQL, o un archivo CSV.

#### `Interfaces/`
Los contratos que Core le exige al mundo exterior, sin saber cómo se implementan.

- **¿Qué van aquí?** `IUserRepository`, `IAuthService`, `IEmailService`, `IUnitOfWork`, etc.
- **Regla:** Solo definiciones (`interface`), nunca implementaciones.
- **¿Por qué existen?** Permiten la inversión de dependencias (la D de SOLID). Core define *qué necesita*, Infrastructure lo *implementa*. Así Core nunca "mira hacia afuera".

#### `DTOs/`
Data Transfer Objects — objetos que viajan entre capas o hacia el cliente. Son distintos de las Entities.

- **¿Qué van aquí?** `LoginRequestDto`, `UserResponseDto`, `CreateProductDto`, etc.
- **Regla:** Solo propiedades, sin lógica. Pueden organizarse en subcarpetas por módulo (`DTOs/Auth/`, `DTOs/Products/`).
- **¿Por qué son distintos de las Entities?** Una `User` entity puede tener el campo `PasswordHash` — ese campo jamás debe viajar al cliente. El `UserResponseDto` expone solo lo que el cliente necesita ver.

#### `Services/`
La lógica de negocio pura. Aquí viven las reglas que hacen que NexusERP sea NexusERP.

- **¿Qué van aquí?** `AuthService`, `InvoiceService`, `ProductService`, etc.
- **Regla:** Dependen solo de interfaces (nunca de implementaciones concretas). Reciben sus dependencias por constructor (inyección de dependencias).
- **¿Por qué en Core y no en API?** Un controller no debería saber *cómo* se autentica un usuario, solo llamar a `authService.Login(dto)` y devolver el resultado. La lógica vive aquí.

#### `Exceptions/`
Excepciones específicas del dominio del negocio.

- **¿Qué van aquí?** `NotFoundException`, `UnauthorizedException`, `DuplicateEmailException`, etc.
- **Regla:** Heredan de `Exception`. El middleware de la API las captura y las convierte en respuestas HTTP apropiadas.
- **¿Por qué no usar excepciones genéricas?** Lanzar `Exception("Not found")` no comunica nada. `NotFoundException` le dice al middleware exactamente qué código HTTP devolver (404) y por qué.

---

### 3. Crear estructura de carpetas en NexusERP.Infrastructure

**Infrastructure implementa lo que Core define.** Sabe de bases de datos, emails, archivos, APIs externas. Depende de Core, pero Core no sabe que Infrastructure existe.

```
NexusERP.Infrastructure/
├── Data/
├── Repositories/
├── Migrations/
└── Services/
```

#### `Data/`
Todo lo relacionado con el acceso a datos a través de Entity Framework Core.

- **¿Qué van aquí?** `AppDbContext.cs` (el DbContext principal), configuraciones de entidades (`EntityTypeConfiguration`).
- **¿Por qué se llama `Data/` y no `Database/`?** Convención del ecosistema .NET — agrupa todo lo relativo al contexto de EF Core.

#### `Repositories/`
Las implementaciones concretas de los `IRepository` definidos en Core.

- **¿Qué van aquí?** `UserRepository : IUserRepository`, `ProductRepository : IProductRepository`, etc.
- **Regla:** Usan `AppDbContext` para interactuar con la base de datos. La lógica de consultas LINQ vive aquí.
- **¿Por qué separar repositories de services?** Los repositories solo se preocupan por *persistir y recuperar* datos. Los services se preocupan por *las reglas de negocio*. Son responsabilidades distintas (principio de responsabilidad única).

#### `Migrations/`
Migraciones generadas automáticamente por EF Core CLI.

- **¿Qué van aquí?** Archivos generados con `dotnet ef migrations add`. **Nunca se editan a mano.**
- **¿Por qué existen?** Son el historial versionado del esquema de base de datos — equivalente a "git log" pero para la estructura de las tablas.

#### `Services/`
Implementaciones de servicios de infraestructura definidos en Core.

- **¿Qué van aquí?** `JwtService` (genera y valida tokens JWT), `BcryptPasswordService` (hashea contraseñas), `EmailService` (envía emails via SMTP), etc.
- **Regla:** Implementan interfaces de `Core/Interfaces/`. Pueden usar librerías externas (BCrypt.Net, System.IdentityModel.Tokens.Jwt).
- **¿Por qué aquí y no en Core?** Porque dependen de librerías externas. Core no puede referenciar NuGet packages de infraestructura.

---

### 4. Crear estructura de carpetas en NexusERP.API

**API es la capa de entrada.** Recibe requests HTTP, los transforma en llamadas a los servicios de Core, y devuelve respuestas. No contiene lógica de negocio.

```
NexusERP.API/
├── Controllers/       ← ya existe
├── Middleware/
├── Program.cs         ← ya existe
├── appsettings.json   ← ya existe
└── appsettings.Development.json  ← ya existe
```

> `Controllers/` ya existe pero contiene `WeatherForecastController.cs` que debe eliminarse (ver punto 1).

#### `Middleware/`
Componentes que interceptan cada request HTTP antes de que llegue al controller, o la response antes de que salga.

- **¿Qué van aquí?** `ExceptionHandlingMiddleware` (captura excepciones de dominio y devuelve respuestas JSON consistentes), `RequestLoggingMiddleware` (opcional).
- **¿Por qué no manejar errores en cada controller?** Porque sería código repetido en cada endpoint. Un middleware global garantiza que todas las excepciones de tipo `NotFoundException` siempre devuelvan 404, sin importar en qué controller ocurran.

---

## Estado esperado después de ejecutar esta spec

```
NexusERP.Core/
├── Entities/            ← vacía (lista para recibir entidades)
├── Interfaces/          ← vacía (lista para recibir contratos)
├── DTOs/                ← vacía (lista para recibir DTOs)
├── Services/            ← vacía (lista para recibir servicios)
├── Exceptions/          ← vacía (lista para recibir excepciones)
└── NexusERP.Core.csproj

NexusERP.Infrastructure/
├── Data/                ← vacía (lista para AppDbContext)
├── Repositories/        ← vacía (lista para implementaciones)
├── Migrations/          ← vacía (EF Core la poblará automáticamente)
├── Services/            ← vacía (lista para JWT, BCrypt, Email)
└── NexusERP.Infrastructure.csproj

NexusERP.API/
├── Controllers/         ← vacía (eliminado WeatherForecastController)
├── Middleware/          ← vacía (lista para ExceptionHandlingMiddleware)
├── Program.cs
├── appsettings.json
├── appsettings.Development.json
└── NexusERP.API.csproj
```

> Git no versiona carpetas vacías. Para que las carpetas queden en el repositorio se agregará un archivo `.gitkeep` en cada una. Este archivo es una convención del ecosistema: no tiene contenido, solo sirve para que git trackee la carpeta.

---

## Lo que esta spec NO hace

- No crea ningún archivo `.cs` de código real (eso es la siguiente spec)
- No modifica `Program.cs`
- No instala paquetes NuGet
- No configura EF Core ni la cadena de conexión

---

## Spec siguiente sugerida

`02-autenticacion-backend.md` — Definir las entidades, interfaces, DTOs y servicios necesarios para implementar el flujo JWT + Refresh Token.
