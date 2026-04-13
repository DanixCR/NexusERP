using NexusERP.Core.DTOs.Auth;

namespace NexusERP.Core.Interfaces;

public interface IAuthService
{
    Task<LoginResponseDto> RegisterAsync(RegisterRequestDto dto);
    Task<LoginResponseDto> LoginAsync(LoginRequestDto dto);
    Task<LoginResponseDto> RefreshTokenAsync(string refreshToken);
    Task LogoutAsync(string refreshToken);
    Task ForgotPasswordAsync(string email);
    Task ResetPasswordAsync(ResetPasswordRequestDto dto);
}
