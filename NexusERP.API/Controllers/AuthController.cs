using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Auth;
using NexusERP.Core.Interfaces;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private const string RefreshTokenCookieName = "refreshToken";

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto)
    {
        var result = await _authService.RegisterAsync(dto);
        SetRefreshTokenCookie(result.RefreshToken);
        return StatusCode(StatusCodes.Status201Created, new
        {
            accessToken = result.AccessToken,
            expiresAt = result.ExpiresAt,
            user = result.User
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
    {
        var result = await _authService.LoginAsync(dto);
        SetRefreshTokenCookie(result.RefreshToken);
        return Ok(new
        {
            accessToken = result.AccessToken,
            expiresAt = result.ExpiresAt,
            user = result.User
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var token = Request.Cookies[RefreshTokenCookieName];
        if (string.IsNullOrEmpty(token))
            return Unauthorized(new { error = "No refresh token provided" });

        var result = await _authService.RefreshTokenAsync(token);
        SetRefreshTokenCookie(result.RefreshToken);
        return Ok(new
        {
            accessToken = result.AccessToken,
            expiresAt = result.ExpiresAt,
            user = result.User
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var token = Request.Cookies[RefreshTokenCookieName];
        if (!string.IsNullOrEmpty(token))
            await _authService.LogoutAsync(token);

        Response.Cookies.Delete(RefreshTokenCookieName);
        return NoContent();
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequestDto dto)
    {
        await _authService.ForgotPasswordAsync(dto.Email);
        return Ok(new { message = "If the email exists, a reset link has been sent" });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequestDto dto)
    {
        await _authService.ResetPasswordAsync(dto);
        return Ok(new { message = "Password updated successfully" });
    }

    private void SetRefreshTokenCookie(string token)
    {
        Response.Cookies.Append(RefreshTokenCookieName, token, new CookieOptions
        {
            HttpOnly = true,          // JavaScript no puede leer esta cookie — protección XSS
            Secure = true,            // Solo se envía por HTTPS
            SameSite = SameSiteMode.None,  // Necesario para requests cross-site (frontend HTTP ↔ backend HTTPS)
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });
    }
}
