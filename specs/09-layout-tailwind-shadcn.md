# Spec 09 — Layout General + Migración a Tailwind CSS v4 + shadcn/ui

## Objetivo

Migrar el frontend de vanilla CSS a **Tailwind CSS v4** + **shadcn/ui**, y crear un layout de ERP profesional con sidebar de navegación y header con información del usuario.

---

## Estado actual

El frontend usa vanilla CSS con ~860 líneas entre `index.css` y `App.css`. Tiene 7 páginas funcionales (Login, Dashboard, Clientes, Proyectos, Empleados, Inventario, Tickets) con componentes inline (tablas, modales, badges) estilizados con clases CSS propias. No existe layout compartido — cada página renderiza su propio header de sección con un botón "Volver al dashboard".

---

## Resultado esperado

Una aplicación que se vea así:

```
┌──────────────────────────────────────────────────┐
│ HEADER  NexusERP                    👤 Dan  Salir│  ← sticky, borde inferior
├──────────┬───────────────────────────────────────┤
│ SIDEBAR  │  CONTENIDO DE LA PÁGINA               │
│          │                                        │
│ Dashboard│  (aquí va cada página: tabla, modales)│
│ Clientes │                                        │
│ Proyectos│                                        │
│ Empleados│                                        │
│ Inventar.│                                        │
│ Tickets  │                                        │
│          │                                        │
└──────────┴───────────────────────────────────────┘
```

- Sidebar colapsable en mobile (hamburger)
- Ítem activo resaltado visualmente en el sidebar
- Header muestra el nombre del usuario logueado y botón de logout
- Todas las páginas usan componentes shadcn/ui en lugar de clases CSS propias

---

## Fase 1 — Instalación de Tailwind CSS v4

Tailwind v4 usa un plugin de Vite en lugar de PostCSS. No requiere `tailwind.config.js` — la configuración es CSS-first.

### 1.1 Instalar dependencias

```bash
cd NexusERP.Client
npm install tailwindcss @tailwindcss/vite
```

### 1.2 Modificar `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

> El alias `@` es requerido por shadcn/ui para resolver imports como `@/components/ui/button`.

### 1.3 Reemplazar `src/index.css`

Eliminar todo el contenido actual y reemplazar con:

```css
@import "tailwindcss";
```

shadcn/ui inyectará sus variables de tema aquí en el paso de inicialización.

### 1.4 Eliminar `src/App.css`

El archivo ya no es necesario. Borrar también el import en `App.tsx`:

```ts
// eliminar esta línea:
import './App.css'
```

---

## Fase 2 — Inicialización de shadcn/ui

### 2.1 Ejecutar el CLI de shadcn

```bash
npx shadcn@latest init
```

Respuestas esperadas en el wizard:
- **Style:** New York
- **Base color:** Neutral
- **CSS variables:** Yes

Esto genera:
- `src/lib/utils.ts` — función `cn()` para combinar clases (usa `clsx` + `tailwind-merge`)
- Agrega variables CSS de tema a `src/index.css` (colores, radios, sombras)
- Crea `components.json` en la raíz del proyecto

### 2.2 Instalar los componentes necesarios

```bash
npx shadcn@latest add button table dialog input select badge avatar dropdown-menu separator
```

Cada comando crea archivos en `src/components/ui/`. No son dependencias de npm — son archivos que se copian al proyecto y se pueden personalizar libremente.

Componentes que se instalan y su equivalencia actual:

| shadcn/ui       | Reemplaza                          |
|-----------------|------------------------------------|
| `Button`        | `.btn-primary`, `.btn-secondary`, `.btn-danger` |
| `Table`         | `.data-table`, `.table-wrapper`    |
| `Dialog`        | `.modal-overlay`, `.modal-card`    |
| `Input`         | `<input className="form-group...">` |
| `Select`        | `<select className="form-select">` |
| `Badge`         | `.status-badge`, `.badge-*`        |
| `Avatar`        | (nuevo — header de usuario)        |
| `DropdownMenu`  | (nuevo — menú de usuario en header)|
| `Separator`     | (divisor en sidebar)               |

---

## Fase 3 — Layout compartido

### 3.1 Crear `src/components/Layout.tsx`

Shell principal que compone sidebar + header + área de contenido.

```tsx
// src/components/Layout.tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

> `<Outlet />` es el punto de inserción de React Router — cada página protegida se renderiza aquí.

### 3.2 Crear `src/components/AppSidebar.tsx`

Sidebar con navegación. Resalta el ítem activo con `NavLink` de React Router.

```tsx
// src/components/AppSidebar.tsx
import { NavLink } from 'react-router-dom'
import { X, LayoutDashboard, Users, FolderKanban, UserRound, Package, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/clients',    label: 'Clientes',   icon: Users },
  { to: '/projects',   label: 'Proyectos',  icon: FolderKanban },
  { to: '/employees',  label: 'Empleados',  icon: UserRound },
  { to: '/products',   label: 'Inventario', icon: Package },
  { to: '/tickets',    label: 'Tickets',    icon: Ticket },
]

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed z-30 flex h-full w-64 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <span className="text-xl font-bold tracking-tight">NexusERP</span>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <Separator />
        <div className="px-4 py-3 text-xs text-muted-foreground">v0.9.0</div>
      </aside>
    </>
  )
}
```

### 3.3 Crear `src/components/AppHeader.tsx`

Header sticky con nombre de usuario y dropdown de logout.

```tsx
// src/components/AppHeader.tsx
import { Menu, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface AppHeaderProps {
  onMenuClick: () => void
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm">
      {/* Hamburger (mobile) */}
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Título desktop (opcional) */}
      <div className="hidden lg:block" />

      {/* Usuario */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user?.name}</span>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

### 3.4 Actualizar `src/App.tsx`

Reemplazar las rutas protegidas para usar el nuevo `Layout`:

```tsx
// Antes (cada ruta anidada con ProtectedRoute individual):
<Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
<Route path="/clients"   element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
// ...

// Después (Layout agrupa todas las rutas protegidas):
<Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/clients"   element={<ClientsPage />} />
  <Route path="/projects"  element={<ProjectsPage />} />
  <Route path="/employees" element={<EmployeesPage />} />
  <Route path="/products"  element={<ProductsPage />} />
  <Route path="/tickets"   element={<TicketsPage />} />
</Route>
```

> Esto funciona porque `Layout` usa `<Outlet />` — React Router renderiza el hijo correspondiente en ese slot.

---

## Fase 4 — Migración de páginas

### Patrón general de migración

Cada página pasa de esto:

```tsx
// Antes
<div className="page-container">
  <div className="page-header">
    <h1 className="page-title">Clientes</h1>
    <button className="btn-primary" onClick={openModal}>+ Nuevo</button>
  </div>

  <table className="data-table">
    <thead><tr><th>Nombre</th></tr></thead>
    <tbody>
      {clients.map(c => (
        <tr key={c.id}>
          <td>{c.name}</td>
          <td>
            <span className="status-badge badge-green">Activo</span>
          </td>
          <td>
            <button className="btn-secondary">Editar</button>
            <button className="btn-danger">Eliminar</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* Modal inline con div overlay */}
  {showModal && (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>Nuevo Cliente</h2>
        <input className="form-group" />
        <button className="btn-primary">Guardar</button>
      </div>
    </div>
  )}
</div>
```

A esto:

```tsx
// Después
<div className="space-y-6">
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold">Clientes</h1>
    <Button onClick={openModal}>+ Nuevo</Button>
  </div>

  <Table>
    <TableHeader>
      <TableRow><TableHead>Nombre</TableHead></TableRow>
    </TableHeader>
    <TableBody>
      {clients.map(c => (
        <TableRow key={c.id}>
          <TableCell>{c.name}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-green-600 border-green-600">Activo</Badge>
          </TableCell>
          <TableCell className="flex gap-2">
            <Button variant="outline" size="sm">Editar</Button>
            <Button variant="destructive" size="sm">Eliminar</Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>

  <Dialog open={showModal} onOpenChange={setShowModal}>
    <DialogContent>
      <DialogHeader><DialogTitle>Nuevo Cliente</DialogTitle></DialogHeader>
      <Input placeholder="Nombre" />
      <DialogFooter>
        <Button onClick={handleSave}>Guardar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</div>
```

### Mapa de componentes por página

| Página | Table | Dialog (crear) | Dialog (editar) | Dialog (confirmar delete) | Badge | Select | Input |
|--------|-------|----------------|-----------------|---------------------------|-------|--------|-------|
| ClientsPage | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| ProjectsPage | ✓ | ✓ | ✓ | ✓ | ✓ status | ✓ status/client | ✓ |
| EmployeesPage | ✓ | ✓ | ✓ | ✓ | — | ✓ dept | ✓ |
| ProductsPage | ✓ | ✓ | ✓ | ✓ | ✓ stock-bajo | — | ✓ |
| TicketsPage | ✓ | ✓ | ✓ | ✓ | ✓ priority/status | ✓ priority | ✓ |

### Mapeo de variantes de Badge

Los status actuales se mapean a variantes de Badge así:

```tsx
// ProjectsPage / TicketsPage — ejemplos
const statusVariant = {
  active:      'default',       // fondo primary
  completed:   'secondary',     // fondo neutro
  cancelled:   'destructive',   // fondo rojo
  pending:     'outline',       // solo borde
}

// Prioridad de tickets
const priorityClass = {
  low:      'text-slate-500 border-slate-300',
  medium:   'text-yellow-600 border-yellow-400',
  high:     'text-orange-600 border-orange-400',
  critical: 'text-red-600 border-red-500',
}
// Usar con: <Badge variant="outline" className={priorityClass[ticket.priority]}>
```

### Cambios específicos por página

**DashboardPage:** Reemplazar los botones de navegación con tarjetas (`Card` de shadcn) que muestren un ícono, nombre del módulo y un resumen de conteo (puede ser placeholder por ahora). El sidebar ya provee la navegación real.

**LoginPage:** Migrar al patrón de `Card` centrada:
- `Card` > `CardHeader` > `CardTitle` ("Iniciar sesión") + `CardDescription`
- `CardContent` con los `Input` de email/password
- `CardFooter` con el `Button` de submit y mensaje de error

Eliminar el botón "Volver al dashboard" de todas las páginas — el sidebar reemplaza esa función.

---

## Fase 5 — Instalar lucide-react (íconos)

shadcn/ui usa `lucide-react` para íconos. Instalarlo:

```bash
npm install lucide-react
```

Íconos usados en el layout (ya referenciados arriba):
- `LayoutDashboard`, `Users`, `FolderKanban`, `UserRound`, `Package`, `Ticket` — sidebar nav
- `Menu`, `X` — toggle mobile
- `LogOut`, `User` — header dropdown

---

## Archivos que se crean / modifican / eliminan

### Nuevos
```
src/components/Layout.tsx
src/components/AppSidebar.tsx
src/components/AppHeader.tsx
src/components/ui/          ← generados por shadcn CLI (no editar a mano)
src/lib/utils.ts            ← generado por shadcn CLI
components.json             ← configuración de shadcn
```

### Modificados
```
vite.config.ts              ← agregar plugin Tailwind + alias @
src/index.css               ← reemplazar todo por @import "tailwindcss" + vars de shadcn
src/App.tsx                 ← nuevo árbol de rutas con Layout + eliminar import App.css
src/pages/LoginPage.tsx     ← migrar a Card + Input + Button
src/pages/DashboardPage.tsx ← migrar a Cards de módulos
src/pages/ClientsPage.tsx   ← migrar a Table + Dialog + Button + Input
src/pages/ProjectsPage.tsx  ← migrar a Table + Dialog + Button + Input + Select + Badge
src/pages/EmployeesPage.tsx ← migrar a Table + Dialog + Button + Input + Select
src/pages/ProductsPage.tsx  ← migrar a Table + Dialog + Button + Input + Badge
src/pages/TicketsPage.tsx   ← migrar a Table + Dialog + Button + Input + Select + Badge
```

### Eliminados
```
src/App.css                 ← reemplazado por Tailwind utilities
```

---

## Dependencias finales a instalar

```bash
npm install tailwindcss @tailwindcss/vite lucide-react
npx shadcn@latest init
npx shadcn@latest add button table dialog input select badge avatar dropdown-menu separator card
```

---

## Orden de ejecución

1. Instalar Tailwind v4 + configurar `vite.config.ts` y `index.css`
2. Inicializar shadcn (`npx shadcn@latest init`) → verifica que el dev server arranca sin errores
3. Instalar componentes shadcn (el comando `add` masivo)
4. Crear `Layout.tsx`, `AppSidebar.tsx`, `AppHeader.tsx`
5. Actualizar `App.tsx` con la nueva estructura de rutas
6. Migrar `LoginPage.tsx`
7. Migrar `DashboardPage.tsx`
8. Migrar las 5 páginas CRUD (una por una, verificando en browser)
9. Eliminar `App.css`

---

## Notas técnicas importantes

- **Tailwind v4 vs v3:** En v4 no existe `tailwind.config.js` ni clases como `dark:bg-gray-900` necesitan configuración extra — el dark mode se configura con `@variant dark` en CSS si se necesita. shadcn/ui ya incluye soporte de dark mode via variables CSS.
- **`cn()` utility:** Siempre usar `cn()` de `@/lib/utils` para combinar clases condicionales en componentes — evita conflictos entre clases de Tailwind.
- **shadcn no es una librería de npm:** Los componentes se copian como código fuente al proyecto. Se pueden personalizar editando `src/components/ui/*.tsx`.
- **El `alias @`** en `vite.config.ts` también requiere ajuste en `tsconfig.json` (paths). shadcn init lo configura automáticamente si detecta el tsconfig.
- **`ProtectedRoute`** permanece igual — sigue protegiendo las rutas. Solo cambia dónde se usa en `App.tsx`.
