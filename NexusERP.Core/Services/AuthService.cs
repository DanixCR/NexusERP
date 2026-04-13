using System.Security.Cryptography;
using NexusERP.Core.DTOs.Auth;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordService _passwordService;
    private readonly ITokenService _tokenService;
    private readonly IEmailService _emailService;

    public AuthService(
        IUserRepository userRepository,
        IPasswordService passwordService,
        ITokenService tokenService,
        IEmailService emailService)
    {
        _userRepository = userRepository;
        _passwordService = passwordService;
        _tokenService = tokenService;
        _emailService = emailService;
    }

    public async Task<LoginResponseDto> RegisterAsync(RegisterRequestDto dto)
    {
        var existing = await _userRepository.GetByEmailAsync(dto.Email);
        if (existing != null)
            throw new ConflictException("Email already registered");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = dto.Email.ToLowerInvariant(),
            PasswordHash = _passwordService.Hash(dto.Password),
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _userRepository.CreateAsync(user);

        var refreshToken = _tokenService.CreateRefreshToken(user.Id);
        await _userRepository.SaveRefreshTokenAsync(refreshToken);

        await _emailService.SendWelcomeEmailAsync(user.Email, user.FirstName);

        return BuildLoginResponse(user, refreshToken.Token);
    }

    public async Task<LoginResponseDto> LoginAsync(LoginRequestDto dto)
    {
        var user = await _userRepository.GetByEmailAsync(dto.Email);

        // Mismo mensaje ante email inexistente o contraseña incorrecta — no revelar cuál falló
        if (user == null || !user.IsActive || !_passwordService.Verify(dto.Password, user.PasswordHash))
            throw new UnauthorizedException("Invalid credentials");

        var refreshToken = _tokenService.CreateRefreshToken(user.Id);
        await _userRepository.SaveRefreshTokenAsync(refreshToken);

        return BuildLoginResponse(user, refreshToken.Token);
    }

    public async Task<LoginResponseDto> RefreshTokenAsync(string token)
    {
        var user = await _userRepository.GetByRefreshTokenAsync(token);
        if (user == null)
            throw new UnauthorizedException("Invalid or expired refresh token");

        var existingToken = user.RefreshTokens.First(t => t.Token == token);
        if (!existingToken.IsActive)
            throw new UnauthorizedException("Invalid or expired refresh token");

        var newRefreshToken = _tokenService.CreateRefreshToken(user.Id);
        await _userRepository.RevokeRefreshTokenAsync(token, newRefreshToken.Token);
        await _userRepository.SaveRefreshTokenAsync(newRefreshToken);

        return BuildLoginResponse(user, newRefreshToken.Token);
    }

    public async Task LogoutAsync(string token)
    {
        await _userRepository.RevokeRefreshTokenAsync(token);
    }

    public async Task ForgotPasswordAsync(string email)
    {
        var user = await _userRepository.GetByEmailAsync(email);
        if (user == null)
            return; // Siempre retornar 200 — no revelar si el email existe

        user.PasswordResetToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user);
        await _emailService.SendPasswordResetEmailAsync(user.Email, user.PasswordResetToken);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequestDto dto)
    {
        var user = await _userRepository.GetByResetTokenAsync(dto.Token);
        if (user == null || user.PasswordResetTokenExpiry < DateTime.UtcNow)
            throw new UnauthorizedException("Invalid or expired reset token");

        user.PasswordHash = _passwordService.Hash(dto.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user);
        await _userRepository.RevokeAllUserRefreshTokensAsync(user.Id);
    }

    private LoginResponseDto BuildLoginResponse(User user, string refreshToken)
    {
        return new LoginResponseDto
        {
            AccessToken = _tokenService.GenerateAccessToken(user),
            RefreshToken = refreshToken,
            ExpiresAt = _tokenService.GetAccessTokenExpiry(),
            User = new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName
            }
        };
    }
}
