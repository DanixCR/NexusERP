using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Users;
using NexusERP.Core.Interfaces;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

    // ── Perfil propio ────────────────────────────────────────────────────────

    [HttpGet("me")]
    public async Task<IActionResult> GetProfile()
    {
        var profile = await _userService.GetProfileAsync(CurrentUserId);
        return Ok(profile);
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var profile = await _userService.UpdateProfileAsync(CurrentUserId, dto);
        return Ok(profile);
    }

    [HttpPut("me/password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        await _userService.ChangePasswordAsync(CurrentUserId, dto);
        return NoContent();
    }

    // ── Gestión de usuarios (Admin) ──────────────────────────────────────────

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var users = await _userService.GetAllUsersAsync();
        return Ok(users);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        var user = await _userService.CreateUserAsync(dto);
        return StatusCode(StatusCodes.Status201Created, user);
    }

    [HttpPut("{id:guid}/role")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateUserRoleDto dto)
    {
        var user = await _userService.UpdateUserRoleAsync(id, dto, CurrentUserId);
        return Ok(user);
    }

    [HttpPut("{id:guid}/active")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] SetActiveDto dto)
    {
        var user = await _userService.SetUserActiveAsync(id, dto.IsActive, CurrentUserId);
        return Ok(user);
    }
}

// DTO inline para el body de SetActive — demasiado pequeño para un archivo propio
public record SetActiveDto(bool IsActive);
