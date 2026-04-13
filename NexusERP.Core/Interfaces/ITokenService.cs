using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(User user);
    DateTime GetAccessTokenExpiry();
    RefreshToken CreateRefreshToken(Guid userId);
    Guid? GetUserIdFromExpiredToken(string token);
}
