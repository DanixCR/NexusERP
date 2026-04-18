using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NexusERP.API.Middleware;
using NexusERP.Core.Interfaces;
using NexusERP.Core.Services;
using NexusERP.Infrastructure.Data;
using NexusERP.Infrastructure.Repositories;
using NexusERP.Infrastructure.Services;
using NexusERP.Infrastructure.Settings;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// ── Base de datos ──────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Configuración con opciones tipadas ────────────────────────────────────────
// En lugar de leer strings sueltos de IConfiguration, cada sección del JSON
// se mapea a una clase POCO. Esto da autocompletado y detección de errores en tiempo de compilación.
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<SendGridSettings>(builder.Configuration.GetSection("SendGrid"));

// ── Autenticación JWT ─────────────────────────────────────────────────────────
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero // sin margen de tolerancia — el token expira exactamente cuando dice
        };
    });

// ── Inyección de dependencias ─────────────────────────────────────────────────
// Registrar en orden: Infrastructure primero, luego Core
// AddScoped = una instancia por request HTTP (lo correcto para repositorios y servicios con estado de request)
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IPasswordService, BcryptPasswordService>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IEmailService, SendGridEmailService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<ClientService>();
builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<ProjectService>();
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
builder.Services.AddScoped<EmployeeService>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<ProductService>();

// ── CORS ──────────────────────────────────────────────────────────────────────
// AllowCredentials() es obligatorio para que el browser acepte Set-Cookie
// en respuestas cross-origin (frontend en :5173, backend en otro puerto).
// Con AllowCredentials NO se puede usar AllowAnyOrigin() — hay que listar orígenes explícitos.
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:5173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ── API ───────────────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Pipeline de middleware (orden importa) ────────────────────────────────────
// 1. Manejo global de excepciones — debe ser el primero para capturar todo
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

// 2. CORS antes de Authentication — el preflight OPTIONS debe resolverse antes
//    de que el middleware de auth intente validar un token que no existe aún
app.UseCors("FrontendPolicy");

// 2. Authentication antes de Authorization — valida el token JWT en cada request
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
