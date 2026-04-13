# Spec 02 — Módulo de Autenticación (Backend)

**Estado:** Ejecutado  
**Alcance:** `NexusERP.Core` + `NexusERP.Infrastructure` + `NexusERP.API`  
**Prerequisito:** Spec 01 ejecutada (estructura de carpetas en su lugar)

---

## Visión general del flujo

```
Cliente                         API                         Infrastructure
  │                              │                                │
  │── POST /auth/register ──────►│                                │
  │                              │── IPasswordService.Hash() ────►│ BCrypt
  │                              │── IUserRepository.Create() ───►│ SQL Server
  │◄── 201 Created ─────────────│                                │
  │                              │                                │
  │── POST /auth/login ─────────►│                                │
  │                              │── IUserRepository.GetByEmail()►│ SQL Server
  │                              │── IPasswordService.Verify() ──►│ BCrypt
  │                              │── ITokenService.GenerateAccessToken() ►│ JWT
  │                              │── ITokenService.GenerateRefreshToken()►│ JWT
  │                              │── IUserRepository.SaveRefreshToken() ─►│ SQL Server
  │◄── 200 { accessToken,        │                                │
  │          refreshToken } ─────│                                │
  │                              │                                │
  │── POST /auth/refresh ───────►│ (cookie HttpOnly con refreshToken)
  │                              │── ITokenService.Validate() ───►│ JWT
  │                              │── IUserRepository.GetByRefreshToken()►│ SQL Server
  │                              │── ITokenService.Rotate() ─────►│ JWT (nuevo par)
  │◄── 200 { accessToken,        │                                │
  │          refreshToken } ─────│                                │
  │                              │                                │
  │── POST /auth/logout ────────►│                                │
  │                              │── IUserRepository.RevokeRefreshToken()►│ SQL Server
  │◄── 204 No Content ───────────│                                │
  │                              │                                │
  │── POST /auth/forgot-password►│                                │
  │                              │── IUserRepository.SaveResetToken() ───►│ SQL Server
  │                              │── IEmailService.SendResetEmail() ─────►│ SendGrid
  │◄── 200 OK ───────────────────│                                │
  │                              │                                │
  │── POST /auth/reset-password ►│                                │
  │                              │── IUserRepository.GetByResetToken() ──►│ SQL Server
  │                              │── IPasswordService.Hash() ────►│ BCrypt
  │                              │── IUserRepository.UpdatePassword() ───►│ SQL Server
  │◄── 200 OK ───────────────────│                                │
```

---

## 1. Entidades (`NexusERP.Core/Entities/`)

### `User.cs`

Representa a un usuario registrado en el sistema.

```
Propiedades:
  Id               Guid          Clave primaria (GUID en lugar de int — evita enumeración de IDs)
  Email            string        Único, requerido, máx. 256 caracteres
  PasswordHash     string        Hash BCrypt — NUNCA la contraseña en texto plano
  FirstName        string        Requerido, máx. 100 caracteres
  LastName         string        Requerido, máx. 100 caracteres
  IsActive         bool          Permite desactivar usuarios sin borrarlos (soft disable)
  CreatedAt        DateTime      UTC, asignado al crear, inmutable
  UpdatedAt        DateTime      UTC, actualizado en cada cambio
  RefreshTokens    List<RefreshToken>    Navegación EF Core (un usuario puede tener varios tokens activos)
  PasswordResetToken       string?       Token de un solo uso para resetear contraseña
  PasswordResetTokenExpiry DateTime?     Fecha de expiración del reset token
```

**¿Por qué GUID como Id?**
Los IDs enteros secuenciales son predecibles. Un atacante puede iterar `/users/1`, `/users/2`... Con GUID eso es imposible. El costo es un índice ligeramente más grande en SQL Server.

**¿Por qué `IsActive` en lugar de borrar el usuario?**
Borrar usuarios rompe las relaciones con registros históricos (facturas emitidas, logs de auditoría). Desactivarlos preserva la integridad referencial.

---

### `RefreshToken.cs`

Representa un refresh token emitido para un usuario. Un usuario puede tener múltiples refresh tokens activos (distintos dispositivos/sesiones).

```
Propiedades:
  Id           Guid        Clave primaria
  Token        string      El token en sí (valor aleatorio seguro)
  UserId       Guid        FK hacia User
  User         User        Propiedad de navegación EF Core
  ExpiresAt    DateTime    UTC — cuándo expira este token (ej. 7 días)
  CreatedAt    DateTime    UTC — cuándo fue creado
  RevokedAt    DateTime?   UTC — null si está activo, fecha si fue revocado
  ReplacedBy   string?     Si fue rotado, guarda el token que lo reemplazó (para auditoría)
```

**¿Por qué una tabla separada para RefreshToken?**
El refresh token tiene su propio ciclo de vida: puede ser revocado, rotado, o expirar independientemente de la sesión del usuario. Guardarlo como campo simple en `User` no permite tener múltiples sesiones activas ni auditar cuándo fue revocado.

**¿Qué es la rotación de tokens?**
Cada vez que se usa un refresh token para obtener un nuevo access token, el refresh token viejo se invalida y se emite uno nuevo. Si un atacante roba el refresh token y lo usa primero, el sistema detecta que el token legítimo fue "reusado" después de ser rotado → revoca toda la familia de tokens de ese usuario.

---

## 2. Interfaces (`NexusERP.Core/Interfaces/`)

### `IUserRepository.cs`

Contrato de acceso a datos para la entidad `User`. Solo define *qué* operaciones existen — no *cómo* se implementan.

```csharp
Task<User?> GetByIdAsync(Guid id);
Task<User?> GetByEmailAsync(string email);
Task<User?> GetByRefreshTokenAsync(string token);
Task<User?> GetByResetTokenAsync(string token);
Task CreateAsync(User user);
Task UpdateAsync(User user);
Task SaveRefreshTokenAsync(RefreshToken refreshToken);
Task RevokeRefreshTokenAsync(string token, string? replacedByToken = null);
Task RevokeAllUserRefreshTokensAsync(Guid userId);
```

**¿Por qué `User?` con nullable en las búsquedas?**
Porque el usuario puede no existir. Devolver `null` es explícito; el servicio que llama decide si lanzar `NotFoundException` o tomar otra acción.

---

### `IAuthService.cs`

Orquesta el flujo de autenticación. Es el único servicio que los controllers de Auth conocen.

```csharp
Task<LoginResponseDto> RegisterAsync(RegisterRequestDto dto);
Task<LoginResponseDto> LoginAsync(LoginRequestDto dto);
Task<LoginResponseDto> RefreshTokenAsync(string refreshToken);
Task LogoutAsync(string refreshToken);
Task ForgotPasswordAsync(string email);
Task ResetPasswordAsync(ResetPasswordRequestDto dto);
```

**¿Por qué un servicio de autenticación y no meter todo en el controller?**
El controller no debe contener lógica. Si mañana queremos exponer autenticación por gRPC o GraphQL, el controller cambia pero `AuthService` no. La lógica de negocio vive en un solo lugar.

---

### `IPasswordService.cs`

Abstrae el algoritmo de hashing de contraseñas. Hoy es BCrypt; mañana podría ser Argon2.

```csharp
string Hash(string plainTextPassword);
bool Verify(string plainTextPassword, string hashedPassword);
```

**¿Por qué una interfaz para esto y no llamar BCrypt directamente desde AuthService?**
Porque Core no puede referenciar librerías externas. `BCrypt.Net` es un paquete NuGet que vive en Infrastructure. La interfaz permite que Core use la funcionalidad sin depender de la implementación.

---

### `ITokenService.cs`

Abstrae la generación y validación de JWT.

```csharp
string GenerateAccessToken(User user);
string GenerateRefreshToken();
Guid? GetUserIdFromExpiredToken(string token);  // para validar refresh sin importar si el access expiró
```

**¿Por qué `GetUserIdFromExpiredToken`?**
Cuando el cliente llama a `/auth/refresh`, el access token ya expiró (ese es el punto). Aún así, necesitamos extraer el `UserId` del token expirado para validar que el refresh token corresponde al mismo usuario. Este método ignora la validación de expiración pero valida firma y estructura.

---

### `IEmailService.cs`

Abstrae el envío de emails. Hoy es SendGrid; podría ser SMTP o cualquier otro proveedor.

```csharp
Task SendPasswordResetEmailAsync(string toEmail, string resetLink);
Task SendWelcomeEmailAsync(string toEmail, string firstName);
```

---

## 3. DTOs (`NexusERP.Core/DTOs/Auth/`)

Se organizan en una subcarpeta `Auth/` dentro de `DTOs/` para separar por módulo.

### `RegisterRequestDto.cs`
```
Email        string    Requerido
Password     string    Requerido, mín. 8 caracteres
FirstName    string    Requerido
LastName     string    Requerido
```

### `LoginRequestDto.cs`
```
Email        string    Requerido
Password     string    Requerido
```

### `LoginResponseDto.cs`
```
AccessToken     string    JWT de corta duración (15 minutos)
RefreshToken    string    Token de larga duración (7 días) — también se envía en cookie HttpOnly
ExpiresAt       DateTime  Cuándo expira el AccessToken (para que el cliente programe el refresh)
User            UserDto   Datos básicos del usuario autenticado
```

### `UserDto.cs`
```
Id           Guid
Email        string
FirstName    string
LastName     string
```

> `UserDto` no incluye `PasswordHash`, `RefreshTokens`, ni `IsActive`. Solo lo que el cliente necesita mostrar.

### `ForgotPasswordRequestDto.cs`
```
Email    string    Requerido
```

### `ResetPasswordRequestDto.cs`
```
Token           string    El token recibido por email
NewPassword     string    Requerido, mín. 8 caracteres
```

---

## 4. Excepciones (`NexusERP.Core/Exceptions/`)

Excepciones de dominio propias que el `ExceptionHandlingMiddleware` (API) convertirá en respuestas HTTP.

| Excepción | HTTP Status | Cuándo se lanza |
|---|---|---|
| `NotFoundException` | 404 | Usuario no encontrado por ID, email, o token |
| `UnauthorizedException` | 401 | Credenciales incorrectas, token inválido o expirado |
| `ConflictException` | 409 | Email ya registrado al hacer register |
| `ValidationException` | 400 | Datos de entrada inválidos (contraseña muy corta, email malformado) |

**¿Por qué excepciones propias y no devolver `bool` o `Result<T>`?**
Las excepciones permiten que el código sea lineal (happy path) sin necesidad de chequear el resultado en cada línea. El middleware las captura globalmente. En proyectos más grandes se considera el patrón `Result<T>`, pero para este nivel es sobreingeniería.

---

## 5. Servicio de Core (`NexusERP.Core/Services/`)

### `AuthService.cs`

Implementa `IAuthService`. Recibe por constructor: `IUserRepository`, `IPasswordService`, `ITokenService`, `IEmailService`.

**Lógica de cada método:**

#### `RegisterAsync`
1. Verificar que no exista un usuario con ese email → si existe, lanzar `ConflictException`
2. Hashear la contraseña con `IPasswordService.Hash()`
3. Crear entidad `User` con `Id = Guid.NewGuid()`, `IsActive = true`, `CreatedAt = DateTime.UtcNow`
4. Persistir con `IUserRepository.CreateAsync()`
5. Generar access token y refresh token con `ITokenService`
6. Persistir `RefreshToken` con `IUserRepository.SaveRefreshTokenAsync()`
7. Opcionalmente enviar email de bienvenida con `IEmailService.SendWelcomeEmailAsync()`
8. Retornar `LoginResponseDto`

#### `LoginAsync`
1. Buscar usuario por email → si no existe, lanzar `UnauthorizedException` (no revelar si el email existe)
2. Verificar que `IsActive == true` → si no, lanzar `UnauthorizedException`
3. Verificar contraseña con `IPasswordService.Verify()` → si falla, lanzar `UnauthorizedException`
4. Generar access token y refresh token
5. Persistir `RefreshToken`
6. Retornar `LoginResponseDto`

> **Seguridad:** Ante email no encontrado o contraseña incorrecta, siempre lanzar el mismo `UnauthorizedException` con el mismo mensaje. Nunca indicar cuál de los dos falló — eso es información para un atacante.

#### `RefreshTokenAsync`
1. Buscar el refresh token en la base de datos → si no existe, lanzar `UnauthorizedException`
2. Verificar que no esté revocado (`RevokedAt == null`) y que no haya expirado (`ExpiresAt > UtcNow`)
3. Verificar que el usuario asociado esté activo
4. Generar nuevo access token y nuevo refresh token (rotación)
5. Revocar el refresh token viejo (`RevokedAt = UtcNow`, `ReplacedBy = nuevoToken`)
6. Persistir el nuevo refresh token
7. Retornar `LoginResponseDto`

#### `LogoutAsync`
1. Buscar el refresh token → si no existe, ignorar (idempotente)
2. Revocar con `IUserRepository.RevokeRefreshTokenAsync()`
3. Retornar sin datos (el controller devolverá 204)

#### `ForgotPasswordAsync`
1. Buscar usuario por email
2. Si no existe → retornar igualmente 200 OK (no revelar si el email está registrado)
3. Generar token seguro aleatorio (`Guid.NewGuid().ToString("N")` o `RandomNumberGenerator`)
4. Guardar `PasswordResetToken` y `PasswordResetTokenExpiry = UtcNow + 1 hora` en el usuario
5. Construir link: `https://[frontend]/reset-password?token={token}`
6. Enviar email con `IEmailService.SendPasswordResetEmailAsync()`

#### `ResetPasswordAsync`
1. Buscar usuario por `PasswordResetToken` → si no existe, lanzar `UnauthorizedException`
2. Verificar que `PasswordResetTokenExpiry > UtcNow` → si expiró, lanzar `UnauthorizedException`
3. Hashear nueva contraseña
4. Actualizar `PasswordHash`, limpiar `PasswordResetToken` y `PasswordResetTokenExpiry`
5. Revocar todos los refresh tokens del usuario (sesiones previas invalidadas)
6. Persistir cambios

---

## 6. Implementaciones en Infrastructure

### `BcryptPasswordService.cs` (`NexusERP.Infrastructure/Services/`)
Implementa `IPasswordService` usando el paquete `BCrypt.Net-Next`.

```
Dependencia NuGet: BCrypt.Net-Next
Hash():   BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12)
Verify(): BCrypt.Net.BCrypt.Verify(password, hash)
```

**¿Qué es el `workFactor`?**
Es el costo computacional del hash. Un `workFactor: 12` significa 2^12 = 4096 iteraciones internas. Hace que calcular el hash tarde ~250ms — imperceptible para el usuario, pero brutal para un ataque de fuerza bruta masivo.

---

### `JwtTokenService.cs` (`NexusERP.Infrastructure/Services/`)
Implementa `ITokenService` usando `System.IdentityModel.Tokens.Jwt`.

```
Dependencia NuGet: System.IdentityModel.Tokens.Jwt, Microsoft.AspNetCore.Authentication.JwtBearer

Configuración (desde appsettings.json):
  Jwt:SecretKey      string    Clave secreta mín. 256 bits (32 caracteres)
  Jwt:Issuer         string    "NexusERP"
  Jwt:Audience       string    "NexusERP-Client"
  Jwt:AccessTokenExpiryMinutes   int    15
  Jwt:RefreshTokenExpiryDays     int    7

GenerateAccessToken():
  Claims: UserId (sub), Email, FirstName + LastName (name)
  Firmado con HMAC-SHA256 y SecretKey
  Expira en AccessTokenExpiryMinutes

GenerateRefreshToken():
  RandomNumberGenerator.GetBytes(64) convertido a Base64
  (No es un JWT — es un token opaco aleatorio)

GetUserIdFromExpiredToken():
  Valida firma pero ignora expiración
  Extrae claim "sub" y lo convierte a Guid
```

**¿Por qué el refresh token no es un JWT?**
El refresh token se guarda en la base de datos de todas formas para poder revocarlo. No tiene sentido que sea un JWT autoverificable si igual hay que ir a la DB. Un token opaco aleatorio es más simple y seguro: sin él no hay forma de extraer información del sistema.

---

### `SendGridEmailService.cs` (`NexusERP.Infrastructure/Services/`)
Implementa `IEmailService` usando la API de SendGrid.

```
Dependencia NuGet: SendGrid

Configuración (desde appsettings.json):
  SendGrid:ApiKey       string    API key de SendGrid
  SendGrid:FromEmail    string    "noreply@nexuserp.com"
  SendGrid:FromName     string    "NexusERP"

SendPasswordResetEmailAsync():
  Construye email con link de reset
  Llama SendGridClient.SendEmailAsync()
  Si falla, loguea el error pero NO lanza excepción (no queremos revelar al usuario si el email falló)

SendWelcomeEmailAsync():
  Email de bienvenida con nombre del usuario
```

---

### `UserRepository.cs` (`NexusERP.Infrastructure/Repositories/`)
Implementa `IUserRepository` usando `AppDbContext` de EF Core.

```
Depende de: AppDbContext (inyectado por constructor)

GetByEmailAsync():     FirstOrDefaultAsync(u => u.Email == email)
GetByRefreshTokenAsync():  Include(u => u.RefreshTokens).FirstOrDefaultAsync(u => u.RefreshTokens.Any(t => t.Token == token))
GetByResetTokenAsync():    FirstOrDefaultAsync(u => u.PasswordResetToken == token)
CreateAsync():         DbContext.Users.Add(user) + SaveChangesAsync()
UpdateAsync():         DbContext.Users.Update(user) + SaveChangesAsync()
SaveRefreshTokenAsync():   DbContext.RefreshTokens.Add(refreshToken) + SaveChangesAsync()
RevokeRefreshTokenAsync(): Busca token, setea RevokedAt y ReplacedBy, SaveChangesAsync()
RevokeAllUserRefreshTokensAsync(): Revoca todos los tokens activos del usuario
```

---

### `AppDbContext.cs` (`NexusERP.Infrastructure/Data/`)

```
DbSets:
  DbSet<User>          Users
  DbSet<RefreshToken>  RefreshTokens

Configuración EF Core:
  User.Email:       HasIndex().IsUnique()   ← índice único para búsquedas rápidas y constraint
  User.Id:          ValueGeneratedNever()   ← el código asigna el GUID, no la DB
  RefreshToken.Token: HasIndex()            ← índice para búsquedas por token
```

---

## 7. Controller (`NexusERP.API/Controllers/`)

### `AuthController.cs`

Ruta base: `/api/auth`  
Depende de: `IAuthService` (inyectado por constructor)  
Sin lógica de negocio — solo recibe, delega, y responde.

---

#### `POST /api/auth/register`

```
Request body:  RegisterRequestDto
Response 201:  LoginResponseDto
Response 409:  { error: "Email already registered" }
Response 400:  { error: "Validation error", details: [...] }
```

Comportamiento:
- Llama `IAuthService.RegisterAsync(dto)`
- Extrae el `RefreshToken` del resultado y lo setea en una **cookie HttpOnly** llamada `refreshToken`
- Devuelve 201 con el `LoginResponseDto` (sin el refreshToken en el body — ya está en la cookie)

---

#### `POST /api/auth/login`

```
Request body:  LoginRequestDto
Response 200:  LoginResponseDto
Response 401:  { error: "Invalid credentials" }
```

Comportamiento:
- Llama `IAuthService.LoginAsync(dto)`
- Setea cookie HttpOnly `refreshToken`
- Devuelve 200 con `LoginResponseDto`

---

#### `POST /api/auth/refresh`

```
Request:       Cookie HttpOnly "refreshToken"
Response 200:  LoginResponseDto
Response 401:  { error: "Invalid or expired refresh token" }
```

Comportamiento:
- Lee el `refreshToken` de la cookie (`Request.Cookies["refreshToken"]`)
- Si la cookie no existe → 401
- Llama `IAuthService.RefreshTokenAsync(refreshToken)`
- Setea nueva cookie con el nuevo refresh token (rotación)
- Devuelve 200

**¿Por qué cookie HttpOnly y no el body?**
JavaScript no puede leer cookies HttpOnly. Esto previene que un script malicioso (XSS) robe el refresh token. El access token sí va en el body porque el cliente lo necesita para adjuntarlo en headers.

---

#### `POST /api/auth/logout`

```
Request:       Cookie HttpOnly "refreshToken"
Response 204:  (sin body)
```

Comportamiento:
- Lee el `refreshToken` de la cookie
- Llama `IAuthService.LogoutAsync(refreshToken)` (si no existe la cookie, no hace nada)
- Elimina la cookie (`Response.Cookies.Delete("refreshToken")`)
- Devuelve 204

---

#### `POST /api/auth/forgot-password`

```
Request body:  ForgotPasswordRequestDto  { email }
Response 200:  { message: "If the email exists, a reset link has been sent" }
```

Comportamiento:
- Llama `IAuthService.ForgotPasswordAsync(dto.Email)`
- **Siempre devuelve 200** — nunca revelar si el email existe o no

---

#### `POST /api/auth/reset-password`

```
Request body:  ResetPasswordRequestDto  { token, newPassword }
Response 200:  { message: "Password updated successfully" }
Response 401:  { error: "Invalid or expired reset token" }
```

Comportamiento:
- Llama `IAuthService.ResetPasswordAsync(dto)`
- Devuelve 200 si el reset fue exitoso

---

## 8. Configuración en `appsettings.json`

Secciones a agregar:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=NexusERP;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "Jwt": {
    "SecretKey": "[REEMPLAZAR — mín. 32 caracteres, usar variable de entorno en producción]",
    "Issuer": "NexusERP",
    "Audience": "NexusERP-Client",
    "AccessTokenExpiryMinutes": 15,
    "RefreshTokenExpiryDays": 7
  },
  "SendGrid": {
    "ApiKey": "[REEMPLAZAR — usar variable de entorno en producción]",
    "FromEmail": "noreply@nexuserp.com",
    "FromName": "NexusERP"
  }
}
```

> **Seguridad:** `SecretKey` y `ApiKey` nunca deben commitearse con valores reales. En desarrollo se usan `dotnet user-secrets`; en producción, variables de entorno o Azure Key Vault.

---

## 9. Paquetes NuGet a instalar

| Paquete | Proyecto | Propósito |
|---|---|---|
| `Microsoft.EntityFrameworkCore.SqlServer` | Infrastructure | EF Core con SQL Server |
| `Microsoft.EntityFrameworkCore.Tools` | Infrastructure | Migraciones EF Core CLI |
| `BCrypt.Net-Next` | Infrastructure | Hashing de contraseñas |
| `System.IdentityModel.Tokens.Jwt` | Infrastructure | Generación de JWT |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | API | Validación de JWT en requests |
| `SendGrid` | Infrastructure | Envío de emails |

---

## 10. Orden de implementación

Una vez validada esta spec, los archivos se crean en este orden para que el proyecto compile en cada paso:

1. **Exceptions** — `NotFoundException`, `UnauthorizedException`, `ConflictException`, `ValidationException`
2. **Entities** — `User`, `RefreshToken`
3. **DTOs** — todos los DTOs de Auth
4. **Interfaces** — `IUserRepository`, `IAuthService`, `IPasswordService`, `ITokenService`, `IEmailService`
5. **Core Service** — `AuthService`
6. **Infrastructure: Data** — `AppDbContext`
7. **Infrastructure: Services** — `BcryptPasswordService`, `JwtTokenService`, `SendGridEmailService`
8. **Infrastructure: Repositories** — `UserRepository`
9. **API: Middleware** — `ExceptionHandlingMiddleware`
10. **API: Controller** — `AuthController`
11. **Program.cs** — registrar todos los servicios en DI, configurar JWT middleware
12. **Migración EF Core** — `dotnet ef migrations add InitialCreate`

---

## Lo que esta spec NO hace

- No implementa autorización por roles (eso es una spec posterior)
- No implementa autenticación con proveedores externos (Google, Microsoft OAuth)
- No implementa rate limiting en endpoints de auth (a considerar como mejora de seguridad)
- No configura CORS (necesario para el frontend — spec separada)

---

## Spec siguiente sugerida

`03-configuracion-efcore.md` — Configuración completa de EF Core: instalación de paquetes, `AppDbContext`, configuración de entidades con Fluent API, y primera migración.
