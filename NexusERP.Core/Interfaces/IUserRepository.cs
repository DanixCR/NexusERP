using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByRefreshTokenAsync(string token);
    Task<User?> GetByResetTokenAsync(string token);
    Task CreateAsync(User user);
    Task UpdateAsync(User user);
    Task SaveRefreshTokenAsync(RefreshToken refreshToken);
    Task RevokeRefreshTokenAsync(string token, string? replacedByToken = null);
    Task RevokeAllUserRefreshTokensAsync(Guid userId);
}
