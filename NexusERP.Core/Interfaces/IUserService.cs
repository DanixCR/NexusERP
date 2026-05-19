using NexusERP.Core.DTOs.Auth;
using NexusERP.Core.DTOs.Users;

namespace NexusERP.Core.Interfaces;

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
