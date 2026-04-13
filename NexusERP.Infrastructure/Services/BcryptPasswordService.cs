using NexusERP.Core.Interfaces;

namespace NexusERP.Infrastructure.Services;

public class BcryptPasswordService : IPasswordService
{
    // workFactor 12 = 2^12 iteraciones internas (~250ms por hash)
    // Imperceptible para el usuario, brutal para un atacante por fuerza bruta
    public string Hash(string plainTextPassword)
        => BCrypt.Net.BCrypt.HashPassword(plainTextPassword, workFactor: 12);

    public bool Verify(string plainTextPassword, string hashedPassword)
        => BCrypt.Net.BCrypt.Verify(plainTextPassword, hashedPassword);
}
