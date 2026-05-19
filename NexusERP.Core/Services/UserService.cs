using NexusERP.Core.DTOs.Auth;
using NexusERP.Core.DTOs.Users;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordService _passwordService;

    public UserService(IUserRepository userRepository, IPasswordService passwordService)
    {
        _userRepository = userRepository;
        _passwordService = passwordService;
    }

    public async Task<UserDto> GetProfileAsync(Guid userId)
    {
        var user = await GetUserOrThrowAsync(userId);
        return ToUserDto(user);
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileDto dto)
    {
        var user = await GetUserOrThrowAsync(userId);

        user.FirstName = dto.FirstName.Trim();
        user.LastName  = dto.LastName.Trim();
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user);
        return ToUserDto(user);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
    {
        var user = await GetUserOrThrowAsync(userId);

        if (!_passwordService.Verify(dto.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedException("La contraseña actual es incorrecta.");

        user.PasswordHash = _passwordService.Hash(dto.NewPassword);
        user.UpdatedAt    = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user);
        await _userRepository.RevokeAllUserRefreshTokensAsync(user.Id);
    }

    public async Task<IEnumerable<UserListItemDto>> GetAllUsersAsync()
        => await _userRepository.GetAllAsync();

    public async Task<UserListItemDto> CreateUserAsync(CreateUserDto dto)
    {
        var existing = await _userRepository.GetByEmailAsync(dto.Email);
        if (existing != null)
            throw new ConflictException("Ya existe un usuario con ese email.");

        if (!Enum.TryParse<UserRole>(dto.Role, out var role))
            role = UserRole.User;

        var user = new User
        {
            Id           = Guid.NewGuid(),
            Email        = dto.Email.ToLowerInvariant(),
            PasswordHash = _passwordService.Hash(dto.Password),
            FirstName    = dto.FirstName.Trim(),
            LastName     = dto.LastName.Trim(),
            Role         = role,
            IsActive     = true,
            CreatedAt    = DateTime.UtcNow,
            UpdatedAt    = DateTime.UtcNow
        };

        await _userRepository.CreateAsync(user);

        return new UserListItemDto
        {
            Id        = user.Id,
            Email     = user.Email,
            FirstName = user.FirstName,
            LastName  = user.LastName,
            Role      = user.Role.ToString(),
            IsActive  = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }

    public async Task<UserListItemDto> UpdateUserRoleAsync(Guid targetUserId, UpdateUserRoleDto dto, Guid requestingUserId)
    {
        if (targetUserId == requestingUserId)
            throw new ValidationException("No podés cambiar tu propio rol.");

        var user = await GetUserOrThrowAsync(targetUserId);

        if (!Enum.TryParse<UserRole>(dto.Role, out var role))
            throw new ValidationException("Rol inválido. Los valores permitidos son 'Admin' y 'User'.");

        user.Role      = role;
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user);
        return ToUserListItemDto(user);
    }

    public async Task<UserListItemDto> SetUserActiveAsync(Guid targetUserId, bool isActive, Guid requestingUserId)
    {
        if (targetUserId == requestingUserId)
            throw new ValidationException("No podés desactivarte a vos mismo.");

        var user = await GetUserOrThrowAsync(targetUserId);

        user.IsActive  = isActive;
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user);

        if (!isActive)
            await _userRepository.RevokeAllUserRefreshTokensAsync(user.Id);

        return ToUserListItemDto(user);
    }

    // ── Helpers privados ────────────────────────────────────────────────────────

    private async Task<User> GetUserOrThrowAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            throw new NotFoundException($"Usuario {userId} no encontrado.");
        return user;
    }

    private static UserDto ToUserDto(User user) => new()
    {
        Id        = user.Id,
        Email     = user.Email,
        FirstName = user.FirstName,
        LastName  = user.LastName,
        Role      = user.Role.ToString()
    };

    private static UserListItemDto ToUserListItemDto(User user) => new()
    {
        Id        = user.Id,
        Email     = user.Email,
        FirstName = user.FirstName,
        LastName  = user.LastName,
        Role      = user.Role.ToString(),
        IsActive  = user.IsActive,
        CreatedAt = user.CreatedAt
    };
}
