namespace NexusERP.Core.DTOs.Clients;

public class CreateClientDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string TaxId { get; set; } = string.Empty;
    public string? Address { get; set; }
}
