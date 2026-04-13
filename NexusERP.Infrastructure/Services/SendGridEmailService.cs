using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Settings;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace NexusERP.Infrastructure.Services;

public class SendGridEmailService : IEmailService
{
    private readonly SendGridSettings _settings;
    private readonly ILogger<SendGridEmailService> _logger;

    public SendGridEmailService(IOptions<SendGridSettings> options, ILogger<SendGridEmailService> logger)
    {
        _settings = options.Value;
        _logger = logger;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken)
    {
        // TODO (spec 03-frontend): reemplazar con la URL real del frontend cuando esté configurada
        _logger.LogInformation("Password reset token for {Email}: {Token}", toEmail, resetToken);

        if (string.IsNullOrEmpty(_settings.ApiKey))
        {
            _logger.LogWarning("SendGrid ApiKey no configurada. Email de reset no enviado.");
            return;
        }

        var client = new SendGridClient(_settings.ApiKey);
        var from = new EmailAddress(_settings.FromEmail, _settings.FromName);
        var to = new EmailAddress(toEmail);
        var subject = "Restablecer contraseña — NexusERP";
        var plainText = $"Tu token de reseteo es: {resetToken}. Expira en 1 hora.";
        var html = $"<p>Tu token de reseteo es: <strong>{resetToken}</strong></p><p>Expira en 1 hora.</p>";

        var message = MailHelper.CreateSingleEmail(from, to, subject, plainText, html);

        try
        {
            await client.SendEmailAsync(message);
        }
        catch (Exception ex)
        {
            // Fallo silencioso — no revelar al usuario si el email no se pudo enviar
            _logger.LogError(ex, "Error al enviar email de reset a {Email}", toEmail);
        }
    }

    public async Task SendWelcomeEmailAsync(string toEmail, string firstName)
    {
        _logger.LogInformation("Welcome email para {FirstName} en {Email}", firstName, toEmail);

        if (string.IsNullOrEmpty(_settings.ApiKey))
        {
            _logger.LogWarning("SendGrid ApiKey no configurada. Email de bienvenida no enviado.");
            return;
        }

        var client = new SendGridClient(_settings.ApiKey);
        var from = new EmailAddress(_settings.FromEmail, _settings.FromName);
        var to = new EmailAddress(toEmail);
        var subject = "¡Bienvenido a NexusERP!";
        var plainText = $"Hola {firstName}, tu cuenta ha sido creada exitosamente.";
        var html = $"<p>Hola <strong>{firstName}</strong>, tu cuenta ha sido creada exitosamente en NexusERP.</p>";

        var message = MailHelper.CreateSingleEmail(from, to, subject, plainText, html);

        try
        {
            await client.SendEmailAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al enviar email de bienvenida a {Email}", toEmail);
        }
    }
}
