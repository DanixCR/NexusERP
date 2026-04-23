# 🏢 NexusERP

> Sistema ERP full-stack construido desde cero con ASP.NET Core 10, React 19 y SQL Server. Proyecto de portafolio activo con integración de IA planificada.

![ASP.NET Core](https://img.shields.io/badge/ASP.NET%20Core-10.0-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQL Server](https://img.shields.io/badge/SQL%20Server-2022-CC2927?style=for-the-badge&logo=microsoftsqlserver&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-Deploy-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)

---

## 📋 Tabla de contenidos

- [Descripción](#-descripción)
- [Características](#-características)
- [Arquitectura](#-arquitectura)
- [Stack tecnológico](#-stack-tecnológico)
- [Instalación](#-instalación-local)
- [Screenshots](#-screenshots)
- [Roadmap](#-roadmap)

---

## 📌 Descripción

**NexusERP** es un sistema de gestión empresarial (ERP) full-stack construido completamente desde cero. Cubre los módulos core de cualquier empresa: clientes, proyectos, empleados, inventario y soporte técnico (tickets), todo bajo una arquitectura limpia y escalable.

El proyecto está en desarrollo activo y tiene planificada una integración con **Claude AI** (Anthropic) para funcionalidades inteligentes como análisis de datos, automatización de reportes y agentes de soporte.

---

## ✨ Características

### ✅ Implementado

| Módulo | Descripción |
|--------|-------------|
| 🔐 **Autenticación** | Login/logout con JWT + Refresh Tokens en cookie HttpOnly, BCrypt para hashing |
| 👥 **Clientes** | CRUD completo con búsqueda en tiempo real y paginación |
| 📁 **Proyectos** | CRUD con estados (Pendiente / En progreso / Completado / Cancelado), filtros por cliente y estado, campo de presupuesto |
| 👨‍💼 **Empleados** | CRUD con departamentos, filtros y paginación |
| 📦 **Inventario** | CRUD de productos con categorías, stock y alertas de stock mínimo |
| 🎫 **Tickets** | CRUD de tickets de soporte con prioridad, estado, categoría y asignación a empleados |

### 🔜 Próximamente

- 🎨 **Rediseño UI** — Migración a Tailwind CSS + shadcn/ui
- 📊 **Módulo de Reportes** — Dashboards con métricas y exportación
- 🤖 **Integración IA** — Agentes con Claude API (Anthropic) y Model Context Protocol (MCP)
- ☁️ **Deploy en Azure** — App Service + Azure SQL Database

---

## 🏛️ Arquitectura

NexusERP implementa **Clean Architecture** (también llamada Onion Architecture). La regla fundamental es que las dependencias apuntan siempre **hacia adentro**: la capa exterior conoce a la interior, nunca al revés.

```
┌─────────────────────────────────────────────────┐
│                  NexusERP.API                   │
│   Controllers · Middleware · Program.cs · DI    │
│         (Capa de presentación / HTTP)           │
├─────────────────────────────────────────────────┤
│             NexusERP.Infrastructure             │
│   EF Core · Repositories · JWT · BCrypt · SMTP │
│         (Implementaciones concretas)            │
├─────────────────────────────────────────────────┤
│                 NexusERP.Core                   │
│     Entities · Interfaces · DTOs · Services     │
│    (Corazón del negocio — sin dependencias)     │
└─────────────────────────────────────────────────┘

         NexusERP.Client  (React 19 + Vite)
         React Query · React Router · TypeScript
```

### ¿Por qué Clean Architecture?

- **Testabilidad** — `Core` es C# puro, testeable sin base de datos ni HTTP.
- **Intercambiabilidad** — Cambiar SQL Server por PostgreSQL solo toca `Infrastructure`.
- **Separación de responsabilidades** — Los controllers no tienen lógica de negocio; las entidades no saben de HTTP.

### Estructura de carpetas

```
NexusERP/
├── NexusERP.API/
│   ├── Controllers/        # Endpoints HTTP
│   ├── Middleware/          # Error handling global
│   └── Program.cs           # DI y configuración
│
├── NexusERP.Core/
│   ├── Entities/            # Modelos de dominio
│   ├── Interfaces/          # Contratos (IRepository, IService)
│   ├── DTOs/                # Objetos de transferencia
│   └── Services/            # Lógica de negocio pura
│
├── NexusERP.Infrastructure/
│   ├── Data/                # DbContext (EF Core)
│   ├── Repositories/        # Implementaciones de IRepository
│   ├── Migrations/          # Migraciones EF Core
│   └── Services/            # JWT, BCrypt, Email
│
└── NexusERP.Client/         # Frontend React + Vite
    └── src/
        ├── pages/           # Páginas por módulo
        ├── hooks/           # React Query hooks
        ├── types/           # TypeScript types/interfaces
        └── api/             # Clientes HTTP (fetch)
```

---

## 🛠️ Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Backend** | ASP.NET Core Web API | 10.0 |
| **ORM** | Entity Framework Core | 10.0 |
| **Base de datos** | SQL Server | 2022 |
| **Autenticación** | JWT + BCrypt + Refresh Tokens | — |
| **Frontend** | React + Vite | 19.2 / 8.0 |
| **Lenguaje frontend** | TypeScript | 6.0 |
| **Data fetching** | TanStack Query (React Query) | v5 |
| **Routing** | React Router | v7 |
| **Linter** | ESLint + typescript-eslint | 9.0 |
| **Deploy** | Azure App Service + Azure SQL | — |

---

## 🚀 Instalación local

### Prerrequisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [SQL Server](https://www.microsoft.com/sql-server) (o SQL Server Express / Docker)
- [EF Core CLI](https://learn.microsoft.com/ef/core/cli/dotnet): `dotnet tool install --global dotnet-ef`

### 1. Clonar el repositorio

```bash
git clone https://github.com/DanixCR/NexusERP.git
cd NexusERP
```

### 2. Configurar el backend

Editá `NexusERP.API/appsettings.Development.json` con tu connection string y JWT secret:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=NexusERP;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "JwtSettings": {
    "SecretKey": "tu-clave-secreta-de-al-menos-32-caracteres",
    "Issuer": "NexusERP",
    "Audience": "NexusERP",
    "ExpirationMinutes": 15,
    "RefreshTokenExpirationDays": 7
  }
}
```

### 3. Crear la base de datos

```bash
dotnet ef database update --project NexusERP.Infrastructure --startup-project NexusERP.API
```

### 4. Iniciar el backend

```bash
dotnet run --project NexusERP.API
# API disponible en https://localhost:7xxx
# Swagger UI en https://localhost:7xxx/swagger
```

### 5. Instalar dependencias del frontend

```bash
cd NexusERP.Client
npm install
```

### 6. Configurar la URL del backend

En `NexusERP.Client/src/api/` asegurate que la base URL apunte a tu instancia local del API.

### 7. Iniciar el frontend

```bash
npm run dev
# App disponible en http://localhost:5173
```

---

## 📸 Screenshots

> 🚧 *Screenshots en construcción — se agregarán en la próxima versión del README.*

| Vista | Preview |
|-------|---------|
| Dashboard | *(próximamente)* |
| Módulo Clientes | *(próximamente)* |
| Módulo Proyectos | *(próximamente)* |
| Módulo Tickets | *(próximamente)* |

---

## 🗺️ Roadmap

### ✅ Fase 1 — Core Backend & Auth
- [x] Solución con Clean Architecture (3 capas)
- [x] Entity Framework Core + SQL Server
- [x] Autenticación JWT con Refresh Tokens
- [x] Hashing de contraseñas con BCrypt
- [x] Endpoints CRUD base

### ✅ Fase 2 — Módulos de negocio
- [x] Módulo Clientes (CRUD + búsqueda + paginación)
- [x] Módulo Proyectos (CRUD + estados + presupuesto)
- [x] Módulo Empleados (CRUD + departamentos)
- [x] Módulo Inventario (CRUD + stock mínimo + alertas)
- [x] Módulo Tickets (CRUD + prioridad + asignación)

### 🔄 Fase 3 — UI/UX profesional *(en progreso)*
- [ ] Migración a Tailwind CSS + shadcn/ui
- [ ] Diseño responsivo completo
- [ ] Temas claro / oscuro

### 📋 Fase 4 — Reportes & Analítica
- [ ] Dashboard con métricas en tiempo real
- [ ] Reportes por módulo (clientes, proyectos, inventario)
- [ ] Exportación a PDF / Excel

### 🤖 Fase 5 — Integración IA
- [ ] Claude API (Anthropic) para análisis inteligente de datos
- [ ] Model Context Protocol (MCP) para agentes con acceso al ERP
- [ ] Agente de soporte automático en Tickets
- [ ] Resúmenes automáticos de proyectos y clientes

### ☁️ Fase 6 — Deploy & DevOps
- [ ] Deploy backend en Azure App Service
- [ ] Azure SQL Database
- [ ] Deploy frontend en Azure Static Web Apps
- [ ] CI/CD con GitHub Actions

---

## 🤝 Contribuciones

Este es un proyecto de portafolio personal. Si encontrás algún bug o tenés sugerencias, podés abrir un [issue](https://github.com/DanixCR/NexusERP/issues).

---

## 📄 Licencia

MIT © [DanixCR](https://github.com/DanixCR)
