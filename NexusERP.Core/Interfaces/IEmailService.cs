namespace NexusERP.Core.Interfaces;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string resetToken);
    Task SendWelcomeEmailAsync(string toEmail, string firstName);
}
