# NexusERP — Contexto del Proyecto

## ¿Qué es NexusERP?
Sistema ERP (Enterprise Resource Planning) construido desde cero como proyecto de aprendizaje activo.
El desarrollador aprende mientras construye, por lo que Claude debe **explicar las decisiones importantes** al implementarlas.

---

## Stack Tecnológico

### Backend — ASP.NET Core 10 Web API
- **Proyecto:** `NexusERP.API`, `NexusERP.Core`, `NexusERP.Infrastructure`
- **Solución:** `NexusERP.slnx` (formato nuevo de Visual Studio 2022+)
- **ORM:** Entity Framework Core 10 con SQL Server
- **Autenticación:** JWT + BCrypt + Refresh Tokens
- **Documentación API:** OpenAPI (ya configurado en `Program.cs`)

### Frontend — React 19 + Vite + TypeScript
- **Proyecto:** `NexusERP.Client/`
- **React:** 19.2 (versión con Server Components estables y mejoras de concurrencia)
- **Build tool:** Vite 8
- **TypeScript:** 6.0
- **Linter:** ESLint 9 con typescript-eslint

### Base de Datos
- SQL Server (local en desarrollo, Azure SQL en producción)
- Migraciones con EF Core CLI

### Deploy
- Azure App Service (backend)
- (Frontend: por definir — candidatos: Azure Static Web Apps o junto al API)

---

## Arquitectura: Clean Architecture

El proyecto sigue **Clean Architecture** (también llamada Onion Architecture). La regla fundamental es que las dependencias apuntan **hacia adentro**: API → Infrastructure → Core. Core no conoce a nadie.

```
┌─────────────────────────────────────────┐
│           NexusERP.API                  │  ← Capa de presentación (Controllers, middleware, DI)
│  Depende de: Core + Infrastructure      │
├─────────────────────────────────────────┤
│        NexusERP.Infrastructure          │  ← Implementaciones concretas (EF Core, SMTP, etc.)
│  Depende de: Core                       │
├─────────────────────────────────────────┤
│           NexusERP.Core                 │  ← El corazón: entidades, interfaces, lógica de negocio
│  No depende de nadie                    │
└─────────────────────────────────────────┘
```

### ¿Por qué Clean Architecture?
- **Testabilidad:** Core es puro C#, se puede testear sin base de datos ni HTTP.
- **Intercambiabilidad:** Puedes cambiar SQL Server por PostgreSQL tocando solo Infrastructure.
- **Separación de responsabilidades:** Los controllers no tienen lógica de negocio; las entidades no saben de HTTP.

### Estructura esperada dentro de cada capa

**NexusERP.Core/**
```
Entities/          ← Clases de dominio (ej. User, Invoice, Product)
Interfaces/        ← Contratos (IUserRepository, IAuthService)
DTOs/              ← Objetos de transferencia de datos
Services/          ← Lógica de negocio pura (sin infraestructura)
Exceptions/        ← Excepciones de dominio propias
```

**NexusERP.Infrastructure/**
```
Data/              ← DbContext de EF Core
Repositories/      ← Implementaciones de IRepository
Migrations/        ← Migraciones EF Core (generadas automáticamente)
Services/          ← Implementaciones concretas (JWT, BCrypt, Email)
```

**NexusERP.API/**
```
Controllers/       ← Endpoints HTTP (solo reciben request, llaman servicios, devuelven response)
Middleware/        ← Manejo global de errores, logging, etc.
Program.cs         ← Configuración de la app y registro de dependencias (DI)
appsettings.json   ← Configuración (connection strings, JWT secret, etc.)
```

---

## Autenticación

### Flujo JWT + Refresh Token
1. Usuario hace POST `/auth/login` → API verifica password con BCrypt → devuelve `AccessToken` (corta duración, ej. 15min) + `RefreshToken` (larga duración, ej. 7 días)
2. Cliente guarda ambos tokens (RefreshToken en cookie HttpOnly, AccessToken en memoria)
3. Cada request incluye `Authorization: Bearer <AccessToken>` en el header
4. Cuando el AccessToken expira → cliente llama POST `/auth/refresh` con el RefreshToken → API devuelve nuevo par de tokens
5. Al hacer logout → se invalida el RefreshToken en la base de datos

### ¿Por qué BCrypt?
BCrypt aplica un "salt" aleatorio y tiene un factor de coste configurable. Si la base de datos es comprometida, los hashes son extremadamente difíciles de revertir por fuerza bruta.

---

## Convenciones de Código

### C# / Backend
- Nombres en **PascalCase** para clases, métodos, propiedades públicas
- Nombres en **camelCase** para parámetros y variables locales
- Interfaces prefijadas con `I` (ej. `IUserRepository`)
- Async/await en todos los métodos de I/O
- No lanzar excepciones genéricas — usar excepciones de dominio propias

### TypeScript / Frontend
- Componentes React en **PascalCase** con extensión `.tsx`
- Hooks personalizados en **camelCase** prefijados con `use` (ej. `useAuth`)
- Tipos e interfaces en **PascalCase**
- Preferir `type` sobre `interface` salvo para contratos que se extiendan

---

## Comandos Frecuentes

### Backend
```bash
# Ejecutar la API en desarrollo
dotnet run --project NexusERP.API

# Agregar migración
dotnet ef migrations add <NombreMigracion> --project NexusERP.Infrastructure --startup-project NexusERP.API

# Aplicar migraciones
dotnet ef database update --project NexusERP.Infrastructure --startup-project NexusERP.API
```

### Frontend
```bash
cd NexusERP.Client

# Desarrollo
npm run dev

# Build para producción
npm run build

# Linting
npm run lint
```

---

## Estado Actual del Proyecto

- [x] Solución creada con 3 proyectos backend + cliente React/Vite
- [ ] Clean Architecture — carpetas y estructura interna por definir
- [ ] EF Core + SQL Server configurado
- [ ] Autenticación JWT implementada
- [ ] Módulos de negocio (usuarios, productos, facturas, etc.)
- [ ] Deploy en Azure

---

## Principios para Claude en este proyecto

1. **Explicar el "por qué"** de cada decisión arquitectónica o de diseño importante.
2. Preferir soluciones simples y directas — este es un proyecto de aprendizaje, no sobreingeniería.
3. Cuando se agregue un nuevo concepto (ej. Middleware, Repository Pattern, DTOs), explicarlo brevemente en contexto.
4. Mantener este archivo actualizado al agregar nuevos módulos o cambios de arquitectura.
