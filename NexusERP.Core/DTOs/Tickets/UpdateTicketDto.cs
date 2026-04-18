using NexusERP.Core.Entities;

namespace NexusERP.Core.DTOs.Tickets;

public class UpdateTicketDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketPriority Priority { get; set; }
    public string Category { get; set; } = string.Empty;
    public Guid? ClientId { get; set; }
    public Guid? AssignedEmployeeId { get; set; }
}
