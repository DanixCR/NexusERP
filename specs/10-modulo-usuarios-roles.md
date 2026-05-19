# Spec 10 — Módulo Usuarios y Roles

## Objetivo

Agregar control de roles al sistema de autenticación existente y exponer dos superficies nuevas: una página de perfil personal (cualquier usuario) y una página de gestión de usuarios exclusiva para Admins.

---

## Estado actual

La entidad `User` tiene `IsActive` pero no tiene campo de rol. El JWT no lleva claim de rol. `UserDto` no expone rol. No existe ningún endpoint de gestión de usuarios. El dropdown del header solo tiene "Cerrar sesión".

---

## Resultado esperado

```
Header dropdown (cualquier usuario):        Header dropdown (Admin):
┌──────────────────────┐                   ┌──────────────────────┐
│ Dan Chaves           │                   │ Dan Chaves           │
│ dan@empresa.com      │                   │ dan@empresa.com      │
│ ─────────────────── │                   │ ─────────────────── │
│ Mi perfil            │                   │ Mi perfil            │
│                      │                   │ Gestión de usuarios  │
│ ─────────────────── │                   │ ─────────────────── │
│ Cerrar sesión        │                   │ Cerrar sesión        │
└──────────────────────┘                   └──────────────────────┘
```

**ProfilePage** (`/profile`): editar nombre y cambiar contraseña.

**UsersPage** (`/admin/users`, solo Admin):
```
┌─────────────────────────────────────────────────────────────────┐
│ Gestión de usuarios                         + Nuevo usuario     │
├────────────────┬──────────────┬────────┬──────────┬────────────┤
│ Nombre         │ Email        │ Rol    │ Estado   │ Acciones   │
├────────────────┼──────────────┼────────┼──────────┼────────────┤
│ Dan Chaves     │ dan@...      │ Admin  │ Activo   │ Rol  On/Off│
│ Ana López      │ ana@...      │ User   │ Activo   │ Rol  On/Off│
└────────────────┴──────────────┴────────┴──────────┴────────────┘
```

---

## Fase 1 — Backend: enum + entidad + migración

### 1.1 Crear `UserRole.cs` en `NexusERP.Core/Entities/`

```csharp
namespace NexusERP.Core.Entities;

public enum UserRole
{
    User,
    Admin
}
```

### 1.2 Modificar `User.cs`

Agregar la propiedad después de `IsActive`:

```csharp
public UserRole Role { get; set; } = UserRole.User;
```

### 1.3 Migración EF Core

```bash
dotnet ef migrations add AddUserRole \
  --project NexusERP.Infrastructure \
  --startup-project NexusERP.API
dotnet ef database update \
  --project NexusERP.Infrastructure \
  --startup-project NexusERP.API
```

La migración agrega la columna `Role` (int, not null, default 0 = User) a la tabla `Users`. Los usuarios existentes quedan como `User`; el primer Admin debe asignarse manualmente en la BD o via seed.

---

## Fase 2 — Backend: DTOs

### 2.1 Actualizar `UserDto.cs`

Agregar:
```csharp
public string Role { get; set; } = string.Empty;   // "Admin" | "User"
```

> Por qué string en vez de enum: el frontend consume JSON; serializar como string evita que el cliente tenga que manejar valores numéricos.

### 2.2 Nuevos DTOs en `NexusERP.Core/DTOs/Users/`

**`UserListItemDto.cs`** — ítem de la tabla de gestión:
```csharp
public class UserListItemDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

**`UpdateProfileDto.cs`** — edición de perfil propio:
```csharp
public class UpdateProfileDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
}
```

**`ChangePasswordDto.cs`** — cambio de contraseña propio:
```csharp
public class ChangePasswordDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
```

**`CreateUserDto.cs`** — creación por Admin:
```csharp
public class CreateUserDto
{
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
}
```

**`UpdateUserRoleDto.cs`** — cambio de rol por Admin:
```csharp
public class UpdateUserRoleDto
{
    public string Role { get; set; } = string.Empty;   // "Admin" | "User"
}
```

---

## Fase 3 — Backend: JWT con claim de rol

### 3.1 Modificar `JwtTokenService.GenerateAccessToken`

Agregar el claim de rol al array de claims:
```csharp
new Claim(ClaimTypes.Role, user.Role.ToString())
```

El middleware de autorización de ASP.NET Core lee `ClaimTypes.Role` automáticamente para `[Authorize(Roles = "Admin")]`.

### 3.2 Modificar `AuthService.BuildLoginResponse`

Incluir el rol en `UserDto`:
```csharp
User = new UserDto
{
    Id        = user.Id,
    Email     = user.Email,
    FirstName = user.FirstName,
    LastName  = user.LastName,
    Role      = user.Role.ToString()
}
```

### 3.3 Asignar rol en `AuthService.RegisterAsync`

Ya se inicializa con el default `UserRole.User` (valor por defecto del enum), no se necesita cambio.

---

## Fase 4 — Backend: repositorio e interfaz

### 4.1 Extender `IUserRepository`

Agregar:
```csharp
Task<IEnumerable<UserListItemDto>> GetAllAsync();
```

> Por qué no `PagedResponse`: la cantidad de usuarios internos en un ERP es tipicamente pequeña (decenas, no miles). Paginación puede agregarse después si escala.

### 4.2 Implementar en `UserRepository`

```csharp
public async Task<IEnumerable<UserListItemDto>> GetAllAsync()
{
    return await _context.Users
        .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
        .Select(u => new UserListItemDto
        {
            Id        = u.Id,
            Email     = u.Email,
            FirstName = u.FirstName,
            LastName  = u.LastName,
            Role      = u.Role.ToString(),
            IsActive  = u.IsActive,
            CreatedAt = u.CreatedAt
        })
        .ToListAsync();
}
```

---

## Fase 5 — Backend: servicio e interfaz

### 5.1 Crear `IUserService` en `NexusERP.Core/Interfaces/`

```csharp
public interface IUserService
{
    Task<UserDto> GetProfileAsync(Guid userId);
    Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileDto dto);
    Task ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
    Task<IEnumerable<UserListItemDto>> GetAllUsersAsync();
    Task<UserListItemDto> CreateUserAsync(CreateUserDto dto);
    Task<UserListItemDto> UpdateUserRoleAsync(Guid targetUserId, UpdateUserRoleDto dto, Guid requestingUserId);
    Task<UserListItemDto> SetUserActiveAsync(Guid targetUserId, bool isActive, Guid requestingUserId);
}
```

### 5.2 Implementar `UserService` en `NexusERP.Core/Services/`

Reglas de negocio importantes:

- **`ChangePasswordAsync`**: verificar `CurrentPassword` con BCrypt antes de hashear la nueva. Si no coincide, lanzar `UnauthorizedException`.
- **`UpdateUserRoleAsync`**: un Admin no puede cambiar su propio rol (evitar lockout accidental). Si `targetUserId == requestingUserId`, lanzar `ValidationException`.
- **`SetUserActiveAsync`**: un Admin no puede desactivarse a sí mismo por la misma razón.
- **`CreateUserAsync`**: verificar email único, lanzar `ConflictException` si ya existe.

---

## Fase 6 — Backend: controlador

### 6.1 Crear `UsersController` en `NexusERP.API/Controllers/`

Todos los endpoints requieren `[Authorize]`. Los de gestión requieren además `[Authorize(Roles = "Admin")]`.

```
GET    /api/users/me               → GetProfile()          [Authorize]
PUT    /api/users/me               → UpdateProfile()       [Authorize]
PUT    /api/users/me/password      → ChangePassword()      [Authorize]
GET    /api/users                  → GetAll()              [Authorize(Roles = "Admin")]
POST   /api/users                  → CreateUser()          [Authorize(Roles = "Admin")]
PUT    /api/users/{id}/role        → UpdateRole()          [Authorize(Roles = "Admin")]
PUT    /api/users/{id}/active      → SetActive()           [Authorize(Roles = "Admin")]
```

El `userId` del usuario autenticado se obtiene del claim JWT:
```csharp
private Guid CurrentUserId =>
    Guid.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
```

Respuestas:
- `GET /api/users/me` → `200 UserDto`
- `PUT /api/users/me` → `200 UserDto`
- `PUT /api/users/me/password` → `204 NoContent`
- `GET /api/users` → `200 IEnumerable<UserListItemDto>`
- `POST /api/users` → `201 UserListItemDto`
- `PUT /api/users/{id}/role` → `200 UserListItemDto`
- `PUT /api/users/{id}/active` → `200 UserListItemDto`

### 6.2 Registrar `UserService` en `Program.cs`

```csharp
builder.Services.AddScoped<IUserService, UserService>();
```

---

## Fase 7 — Frontend: tipos y hooks

### 7.1 Actualizar `auth.types.ts`

Agregar `role` al tipo `User`:
```ts
export type UserRole = 'Admin' | 'User'

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
}
```

> `role` viene incluido en el `user` de la respuesta de login/refresh, así que no hay cambio en `AuthContext`.

### 7.2 Crear `user.types.ts`

```ts
export type UserListItem = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'Admin' | 'User'
  isActive: boolean
  createdAt: string
}

export type UpdateProfileRequest = {
  firstName: string
  lastName: string
}

export type ChangePasswordRequest = {
  currentPassword: string
  newPassword: string
}

export type CreateUserRequest = {
  email: string
  firstName: string
  lastName: string
  password: string
  role: 'Admin' | 'User'
}

export type UpdateUserRoleRequest = {
  role: 'Admin' | 'User'
}
```

### 7.3 Crear `userService.ts`

```ts
export const userService = {
  getProfile: () =>
    apiClient.get<User>('/users/me').then(r => r.data),

  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.put<User>('/users/me', data).then(r => r.data),

  changePassword: (data: ChangePasswordRequest) =>
    apiClient.put('/users/me/password', data),

  getAll: () =>
    apiClient.get<UserListItem[]>('/users').then(r => r.data),

  createUser: (data: CreateUserRequest) =>
    apiClient.post<UserListItem>('/users', data).then(r => r.data),

  updateRole: (id: string, data: UpdateUserRoleRequest) =>
    apiClient.put<UserListItem>(`/users/${id}/role`, data).then(r => r.data),

  setActive: (id: string, isActive: boolean) =>
    apiClient.put<UserListItem>(`/users/${id}/active`, { isActive }).then(r => r.data),
}
```

### 7.4 Crear `useUsers.ts`

```ts
// perfil propio
export function useUpdateProfile()   { ... }
export function useChangePassword()  { ... }

// gestión (Admin)
export function useUsers()           { ... }    // GET /users
export function useCreateUser()      { ... }
export function useUpdateUserRole()  { ... }
export function useSetUserActive()   { ... }
```

---

## Fase 8 — Frontend: AppHeader

Actualizar el `DropdownMenuContent` en `AppHeader.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'

// dentro del componente:
const navigate = useNavigate()

// JSX del menú:
<DropdownMenuContent align="end" className="w-52">
  <DropdownMenuLabel className="font-normal">
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium">{user?.firstName} {user?.lastName}</span>
      <span className="text-xs text-muted-foreground">{user?.email}</span>
    </div>
  </DropdownMenuLabel>
  <DropdownMenuSeparator />

  <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
    <User className="mr-2 h-4 w-4" />
    Mi perfil
  </DropdownMenuItem>

  {user?.role === 'Admin' && (
    <DropdownMenuItem onClick={() => navigate('/admin/users')} className="cursor-pointer">
      <Users className="mr-2 h-4 w-4" />
      Gestión de usuarios
    </DropdownMenuItem>
  )}

  <DropdownMenuSeparator />

  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
    <LogOut className="mr-2 h-4 w-4" />
    Cerrar sesión
  </DropdownMenuItem>
</DropdownMenuContent>
```

Íconos a importar: `User`, `Users`, `LogOut` de `lucide-react`.

---

## Fase 9 — Frontend: ProfilePage

**Ruta:** `/profile`  
**Acceso:** cualquier usuario autenticado

La página tiene dos secciones independientes con sus propias acciones:

```
┌─────────────────────────────────────────────┐
│ Mi perfil                                    │
│                                              │
│  ┌─ Información personal ─────────────────┐ │
│  │  Nombre *      [____________]           │ │
│  │  Apellido *    [____________]           │ │
│  │               [Guardar cambios]         │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─ Cambiar contraseña ────────────────────┐ │
│  │  Contraseña actual  [____________]      │ │
│  │  Nueva contraseña   [____________]      │ │
│  │  Confirmar          [____________]      │ │
│  │                     [Actualizar]        │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- El campo email se muestra como solo lectura (no editable).
- La validación de "nueva contraseña" y "confirmar" se hace en el cliente antes de llamar al backend.
- Tras guardar el perfil con éxito, actualizar el `user` en `AuthContext` con `setUser` (el nombre en el header se actualiza al instante).
- Tras cambiar contraseña con éxito, limpiar el formulario y mostrar mensaje de confirmación.

---

## Fase 10 — Frontend: UsersPage

**Ruta:** `/admin/users`  
**Acceso:** solo `Admin` (protegido con `AdminRoute`)

### Componente `AdminRoute`

Similar a `ProtectedRoute` pero agrega verificación de rol:

```tsx
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'Admin') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
```

### Tabla de usuarios

Columnas: Nombre (apellido, nombre), Email, Rol (Badge), Estado (Badge activo/inactivo), Acciones.

**Acciones por fila:**
- **Cambiar rol**: dropdown inline `Select` con opciones "Admin" / "User". Confirmar con dialog antes de aplicar.
- **Activar / Desactivar**: botón toggle con dialog de confirmación. El botón del propio usuario autenticado aparece deshabilitado.

**Crear usuario**: botón "+ Nuevo usuario" que abre un `Dialog` con formulario (email, firstName, lastName, rol, password).

**Badges:**

```tsx
// Rol
<Badge variant={item.role === 'Admin' ? 'default' : 'secondary'}>
  {item.role}
</Badge>

// Estado
<Badge variant={item.isActive ? 'outline' : 'destructive'}
       className={item.isActive ? 'text-green-600 border-green-600' : ''}>
  {item.isActive ? 'Activo' : 'Inactivo'}
</Badge>
```

---

## Fase 11 — Frontend: rutas

### Actualizar `App.tsx`

```tsx
import { AdminRoute } from './components/AdminRoute'
import { ProfilePage }  from './pages/ProfilePage'
import { UsersPage }    from './pages/UsersPage'

// Dentro del grupo protegido con Layout:
<Route path="/profile"      element={<ProfilePage />} />
<Route path="/admin/users"  element={<AdminRoute><UsersPage /></AdminRoute>} />
```

`AdminRoute` se coloca alrededor del contenido de la ruta, no de `Layout` — el layout (sidebar/header) sigue siendo el mismo.

---

## Archivos que se crean / modifican / eliminan

### Backend — nuevos
```
NexusERP.Core/Entities/UserRole.cs
NexusERP.Core/DTOs/Users/UserListItemDto.cs
NexusERP.Core/DTOs/Users/UpdateProfileDto.cs
NexusERP.Core/DTOs/Users/ChangePasswordDto.cs
NexusERP.Core/DTOs/Users/CreateUserDto.cs
NexusERP.Core/DTOs/Users/UpdateUserRoleDto.cs
NexusERP.Core/Interfaces/IUserService.cs
NexusERP.Core/Services/UserService.cs
NexusERP.API/Controllers/UsersController.cs
NexusERP.Infrastructure/Migrations/<timestamp>_AddUserRole.cs
```

### Backend — modificados
```
NexusERP.Core/Entities/User.cs                  ← agregar Role
NexusERP.Core/DTOs/Auth/UserDto.cs              ← agregar Role
NexusERP.Core/Interfaces/IUserRepository.cs     ← agregar GetAllAsync
NexusERP.Infrastructure/Repositories/UserRepository.cs  ← implementar GetAllAsync
NexusERP.Infrastructure/Services/JwtTokenService.cs     ← agregar claim de rol
NexusERP.Core/Services/AuthService.cs           ← incluir Role en UserDto
NexusERP.API/Program.cs                         ← registrar UserService
```

### Frontend — nuevos
```
src/types/user.types.ts
src/services/userService.ts
src/hooks/useUsers.ts
src/components/AdminRoute.tsx
src/pages/ProfilePage.tsx
src/pages/UsersPage.tsx
```

### Frontend — modificados
```
src/types/auth.types.ts         ← agregar UserRole + campo role a User
src/components/AppHeader.tsx    ← nuevo dropdown con perfil y gestión
src/App.tsx                     ← nuevas rutas
```

---

## Notas técnicas

- **Autorización basada en roles en ASP.NET Core**: al agregar `ClaimTypes.Role` al JWT, `[Authorize(Roles = "Admin")]` funciona automáticamente. El middleware verifica el claim antes de entrar al action method.

- **`UpdateProfileDto` no incluye email**: cambiar el email requiere re-verificación y es una operación más compleja. Se deja fuera del scope de esta spec.

- **No existe `PUT /api/users/{id}/active` con body vs query param**: se pasa el valor en el body `{ isActive: bool }` para consistencia con el resto de la API.

- **El primer Admin**: `RegisterAsync` asigna `UserRole.User` por defecto. Para el primer Admin, hay que actualizar la BD directamente (`UPDATE Users SET Role = 1 WHERE Email = 'admin@...'`) o crear un endpoint de seed que se desactiva después del primer uso. Eso queda fuera de esta spec.

- **Seguridad**: el claim de rol vive en el JWT. Si el Admin cambia el rol de un usuario, el cambio no se refleja hasta que ese usuario refresque su token. Para un ERP interno con usuarios contados, esto es aceptable.
