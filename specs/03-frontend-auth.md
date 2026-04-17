# Spec 03 — Autenticación Frontend (React)

**Estado:** Pendiente de validación  
**Alcance:** `NexusERP.Client/src/`  
**Prerequisito:** Spec 02 ejecutada (backend de autenticación operativo con JWT + cookies HttpOnly)

---

## Visión general del flujo cliente

```
Usuario                   React App                    API Backend
  │                           │                              │
  │── Ingresa email/pass ─────►│                              │
  │                           │── POST /auth/login ──────────►│
  │                           │◄── { accessToken, user } ────│
  │                           │    (refreshToken en cookie)  │
  │                           │── guarda accessToken en RAM  │
  │                           │── guarda user en AuthContext │
  │◄── Redirige a /dashboard ─│                              │
  │                           │                              │
  │── Hace cualquier request ─►│                              │
  │                           │── interceptor adjunta JWT ──►│
  │                           │◄── 200 OK ───────────────────│
  │                           │                              │
  │                           │── interceptor detecta 401 ──►│
  │                           │── POST /auth/refresh ────────►│ (cookie automática)
  │                           │◄── { accessToken } ──────────│
  │                           │── reintenta request original►│
  │                           │◄── 200 OK ───────────────────│
  │                           │                              │
  │── Hace logout ────────────►│                              │
  │                           │── POST /auth/logout ─────────►│
  │                           │── limpia accessToken en RAM  │
  │◄── Redirige a /login ──────│                              │
```

**¿Por qué el accessToken vive en RAM y no en localStorage?**
`localStorage` es accesible por cualquier script JavaScript en la página. Si la app tiene una vulnerabilidad XSS, un script malicioso puede robar el token. En RAM (variable de estado React) el token desaparece al cerrar la pestaña y nunca es accesible desde fuera del contexto de la app.

El `refreshToken` vive en una cookie HttpOnly — JavaScript no puede leerla. El navegador la adjunta automáticamente en cada request al mismo dominio.

---

## Archivos a crear

```
src/
├── types/
│   └── auth.types.ts          ← Tipos TypeScript del módulo de auth
├── services/
│   └── authService.ts         ← Llamadas HTTP a /auth/*
├── lib/
│   └── axios.ts               ← Instancia de Axios configurada con interceptores
├── hooks/
│   └── useAuth.ts             ← Hook para consumir AuthContext
├── contexts/
│   └── AuthContext.tsx        ← Estado global de autenticación
└── pages/
    └── LoginPage.tsx          ← Pantalla de login
```

> **Nueva carpeta: `src/lib/`** — Para utilidades de configuración de librerías externas (Axios, React Query). Es distinta de `services/` porque no contiene llamadas a endpoints, sino configuración de infraestructura.

> **Nueva carpeta: `src/contexts/`** — Para los React Contexts que proveen estado global. Se separa de `hooks/` porque un Context incluye tanto el Provider (componente) como el hook de consumo.

---

## 1. Tipos (`src/types/auth.types.ts`)

Centraliza todos los tipos del módulo de autenticación. Espeja exactamente los DTOs del backend.

```typescript
// Espeja LoginRequestDto del backend
type LoginRequest = {
  email: string
  password: string
}

// Espeja RegisterRequestDto del backend
type RegisterRequest = {
  email: string
  password: string
  firstName: string
  lastName: string
}

// Espeja UserDto del backend
type User = {
  id: string         // GUID como string en el frontend
  email: string
  firstName: string
  lastName: string
}

// Espeja LoginResponseDto del backend
// Nota: refreshToken NO está aquí — viaja en cookie HttpOnly, invisible para JS
type AuthResponse = {
  accessToken: string
  expiresAt: string  // ISO 8601 — cuándo expira el accessToken
  user: User
}

// Estado del contexto de autenticación
type AuthState = {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// Acciones disponibles en el contexto
type AuthContextValue = AuthState & {
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
}
```

**¿Por qué los tipos espejean exactamente los DTOs del backend?**
Si el backend cambia un campo (ej. renombra `firstName` a `givenName`), TypeScript detectará el desajuste en todos los lugares donde se use ese tipo. Sin esta sincronización, los errores aparecerían en runtime.

---

## 2. Configuración de Axios (`src/lib/axios.ts`)

Este archivo crea y exporta una instancia de Axios preconfigurada. **Toda llamada al API pasa por aquí.**

### Configuración base

```typescript
// URL base del API — en desarrollo apunta al backend local
// En producción, Vite reemplaza con la variable de entorno VITE_API_URL
baseURL: import.meta.env.VITE_API_URL ?? 'https://localhost:7001/api'

// Necesario para que el navegador envíe la cookie HttpOnly del refreshToken
withCredentials: true
```

**¿Qué es `withCredentials: true`?**
Por defecto, los navegadores bloquean el envío de cookies en requests cross-origin (frontend en `localhost:5173` → backend en `localhost:7001`). Con `withCredentials: true`, el navegador incluye las cookies. El backend debe tener CORS configurado con `AllowCredentials()` — que ya está en la Spec 02.

### Interceptor de request (adjuntar JWT)

Se ejecuta **antes** de cada request saliente.

```
Lógica:
  1. Leer el accessToken del módulo de estado (exportado desde AuthContext)
  2. Si existe → agregar header: Authorization: Bearer <accessToken>
  3. Si no existe → dejar pasar el request sin header (el backend devolverá 401)
```

**¿Por qué no leer el token de localStorage?**
Porque el token vive en RAM (estado React). El interceptor necesita una forma de acceder a ese estado fuera de React. La solución es un módulo auxiliar que actúa como "puente": `AuthContext` le entrega el token a este módulo al hacer login, y el interceptor lo lee desde ahí.

### Interceptor de response (refresh automático)

Se ejecuta cuando llega una **respuesta de error**.

```
Lógica:
  1. Si el error es 401 Y el request no era ya /auth/refresh (evitar loop infinito):
     a. Intentar POST /auth/refresh (la cookie HttpOnly se envía automáticamente)
     b. Si el refresh tiene éxito:
        - Actualizar el accessToken en el módulo de estado
        - Reintentar el request original con el nuevo token
        - Retornar la respuesta del reintento
     c. Si el refresh falla (refresh token expirado o revocado):
        - Limpiar el estado de autenticación
        - Redirigir al usuario a /login
        - Rechazar la promesa con el error original
  2. Si el error no es 401 → propagar el error normalmente
```

**¿Por qué hay que evitar el loop infinito?**
Si el request a `/auth/refresh` también devuelve 401 (refresh token inválido), el interceptor volvería a intentar refrescar, y así infinitamente. La condición `request no era /auth/refresh` corta ese ciclo.

**¿Qué pasa con múltiples requests en vuelo cuando el token expira?**
Si hay 3 requests simultáneos y todos reciben 401, podrían dispararse 3 refreshes en paralelo. La solución es usar una variable `isRefreshing` (flag booleano) y una cola de callbacks pendientes:
- El primer 401 setea `isRefreshing = true` y ejecuta el refresh
- Los siguientes 401 encolan sus callbacks en lugar de refrescar
- Cuando el refresh termina, se vacía la cola con el nuevo token

---

## 3. Servicio de autenticación (`src/services/authService.ts`)

Encapsula todas las llamadas HTTP al módulo `/auth` del backend. Los hooks y componentes nunca llaman a Axios directamente — siempre pasan por aquí.

```typescript
// login: POST /api/auth/login
// Recibe credenciales, devuelve AuthResponse
login(data: LoginRequest): Promise<AuthResponse>

// register: POST /api/auth/register
// Recibe datos de registro, devuelve AuthResponse (auto-login tras registro)
register(data: RegisterRequest): Promise<AuthResponse>

// logout: POST /api/auth/logout
// No recibe parámetros (el refreshToken viaja en cookie)
// El backend revoca el token y elimina la cookie
logout(): Promise<void>

// refresh: POST /api/auth/refresh (llamado solo por el interceptor de Axios)
// No recibe parámetros (el refreshToken viaja en cookie)
// Devuelve nuevo AuthResponse con accessToken actualizado
refresh(): Promise<AuthResponse>
```

**¿Por qué `refresh` está en el servicio si solo lo llama el interceptor?**
Centralizar todas las llamadas al API en `services/` hace que sea fácil encontrar qué endpoints existen, qué retornan, y dónde cambiar si el contrato cambia. El interceptor importa `authService.refresh()` en lugar de hardcodear la URL.

---

## 4. Context de autenticación (`src/contexts/AuthContext.tsx`)

Provee el estado de autenticación a toda la app. Cualquier componente puede saber si el usuario está logueado y llamar a `login`/`logout`.

### Estado interno

```typescript
state: {
  user: User | null       // null = no autenticado
  accessToken: string | null
  isLoading: boolean      // true mientras se verifica la sesión al iniciar la app
}
```

### Comportamiento al montar (`useEffect` inicial)

Al cargar la app, antes de renderizar cualquier ruta, el contexto intenta restaurar la sesión:

```
1. Setear isLoading = true
2. Llamar authService.refresh()
   - Si tiene éxito: el usuario tenía una sesión activa → guardar user y accessToken
   - Si falla (401): no había sesión o expiró → estado queda con user=null
3. Setear isLoading = false
```

**¿Por qué hacer refresh al inicio?**
El `accessToken` vive en RAM — si el usuario recarga la página, lo pierde. La cookie HttpOnly persiste. Al iniciar, el frontend llama al backend: "¿todavía tenés mi refreshToken válido?". Si sí, emite un nuevo accessToken y el usuario no percibe ningún logout. Si no, va al login.

### Método `login`

```
1. Llamar authService.login(data)
2. Guardar accessToken en estado
3. Actualizar el "puente" que usa el interceptor de Axios
4. Guardar user en estado
```

### Método `register`

```
1. Llamar authService.register(data)
2. Mismo comportamiento que login (auto-login tras registro)
```

### Método `logout`

```
1. Llamar authService.logout() — backend revoca el token
2. Limpiar accessToken del estado y del "puente" de Axios
3. Limpiar user del estado
```

### Hook `useAuth` (`src/hooks/useAuth.ts`)

Un hook que consume `AuthContext` y lanza un error claro si se usa fuera del Provider.

```typescript
// Uso en cualquier componente:
const { user, isAuthenticated, login, logout } = useAuth()
```

**¿Por qué un hook separado en lugar de usar `useContext(AuthContext)` directamente?**
Dos razones: primero, `useAuth()` verifica que se esté usando dentro del `AuthProvider` y lanza un error descriptivo si no (`"useAuth must be used within AuthProvider"`). Segundo, en el futuro si el contexto cambia de implementación, todos los consumidores siguen usando `useAuth()` sin cambios.

---

## 5. Página de Login (`src/pages/LoginPage.tsx`)

Pantalla de login con formulario. Sin librerías de formularios — React state nativo para este nivel de complejidad.

### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│         NexusERP                        │
│         (logo / nombre del sistema)     │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Iniciar sesión                   │  │
│  │                                   │  │
│  │  Email *                          │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ usuario@empresa.com         │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  Contraseña *                     │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ ••••••••                    │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  [          Ingresar           ]  │  │
│  │                                   │  │
│  │  ¿Olvidaste tu contraseña?        │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Estado del componente

```typescript
email: string           // valor del input
password: string        // valor del input
error: string | null    // mensaje de error a mostrar (ej. "Credenciales inválidas")
isSubmitting: boolean   // true mientras espera respuesta del API — deshabilita el botón
```

### Comportamiento del formulario

```
onSubmit:
  1. Validación básica en cliente:
     - Email no vacío y tiene formato válido (regex simple o input type="email")
     - Password no vacío
     - Si falla: setear error, no llamar al API
  2. setIsSubmitting(true), limpiar error previo
  3. Llamar useAuth().login({ email, password })
  4. Si tiene éxito:
     - React Router redirige a /dashboard (o a la ruta que intentaba acceder antes)
  5. Si falla:
     - Capturar el error de Axios
     - Si status 401: error = "Email o contraseña incorrectos"
     - Si otro error: error = "Error inesperado. Intentá de nuevo."
  6. setIsSubmitting(false)
```

**¿Por qué validar en el cliente si el backend también valida?**
La validación del cliente mejora la UX: feedback instantáneo sin esperar el round-trip al servidor. La validación del backend es la que realmente importa para la seguridad — la del cliente es complementaria y conveniente.

**¿Por qué el mensaje de error es genérico para 401?**
"Email o contraseña incorrectos" en lugar de "ese email no existe" o "contraseña incorrecta". Revelar cuál de los dos falló ayuda a un atacante a enumerar usuarios válidos.

### Manejo del estado `isLoading` del AuthContext

Mientras `AuthContext` está verificando la sesión al inicio (el `useEffect` de refresh), la `LoginPage` puede parpadear antes de ser reemplazada si la sesión se restaura. Para evitar esto:

```
Si isLoading === true → renderizar un spinner o pantalla en blanco
Si isAuthenticated === true → redirigir a /dashboard (ya hay sesión activa)
Si !isLoading && !isAuthenticated → mostrar el formulario
```

---

## 6. Configuración de rutas (`src/main.tsx` o `src/App.tsx`)

Para que el routing funcione, `App.tsx` necesita:

```typescript
// Estructura de rutas mínima para esta spec:

<BrowserRouter>
  <AuthProvider>          // ← provee el estado de auth a toda la app
    <QueryClientProvider> // ← provee React Query a toda la app
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </QueryClientProvider>
  </AuthProvider>
</BrowserRouter>
```

### `ProtectedRoute` (componente auxiliar)

Un wrapper que redirige al login si el usuario no está autenticado.

```
Lógica:
  Si isLoading → mostrar spinner (AuthContext aún está verificando)
  Si isAuthenticated → renderizar children (la página protegida)
  Si !isAuthenticated → <Navigate to="/login" state={{ from: location }} />
```

**¿Qué es `state={{ from: location }}`?**
Guarda la ruta que el usuario intentaba acceder antes de ser redirigido al login. Después de hacer login, la app puede redirigir a esa ruta en lugar de siempre ir a `/dashboard`. Mejora la UX: si alguien bookmarkeó `/invoices/123`, después de loguearse llega ahí directamente.

---

## 7. Variables de entorno

Archivo a crear: `NexusERP.Client/.env.development`

```
VITE_API_URL=https://localhost:7001/api
```

**¿Por qué no hardcodear la URL en el código?**
En producción la URL será distinta (ej. `https://api.nexuserp.com/api`). Con variables de entorno, Vite sustituye el valor según el entorno sin tocar el código.

> `.env.development` **no** se commitea con valores de producción. `.env.production` se configura en el servidor de CI/CD.

---

## 8. Orden de implementación

Una vez validada esta spec, los archivos se crean en este orden (cada uno compila sobre el anterior):

1. **`src/types/auth.types.ts`** — tipos primero, todo lo demás los importa
2. **`src/lib/axios.ts`** — instancia base sin interceptores complejos todavía
3. **`src/services/authService.ts`** — llama al API usando la instancia de Axios
4. **`src/contexts/AuthContext.tsx`** — estado global + lógica de sesión
5. **`src/hooks/useAuth.ts`** — hook consumidor del contexto
6. **`src/lib/axios.ts`** (revisión) — agregar interceptores que referencian `AuthContext`
7. **`src/pages/LoginPage.tsx`** — formulario usando `useAuth`
8. **`src/App.tsx`** — configurar BrowserRouter + AuthProvider + QueryClientProvider + rutas
9. **`.env.development`** — variable `VITE_API_URL`

---

## Lo que esta spec NO hace

- No implementa la página de registro (`RegisterPage`) — spec separada
- No implementa recuperación de contraseña (`ForgotPasswordPage`) — spec separada
- No implementa el layout del dashboard (sidebar, navbar) — spec separada
- No aplica estilos finales — solo estructura funcional
- No configura tests unitarios para los hooks — a considerar en una spec de testing

---

## Spec siguiente sugerida

`04-frontend-dashboard.md` — Layout principal del ERP: sidebar de navegación, topbar con datos del usuario, y página de dashboard con métricas básicas.
