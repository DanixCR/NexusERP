namespace NexusERP.Core.Entities;

public class Ticket
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketPriority Priority { get; set; }
    public TicketStatus Status { get; set; }
    public string Category { get; set; } = string.Empty;

    public Guid? ClientId { get; set; }
    public Client? Client { get; set; }

    public Guid? AssignedEmployeeId { get; set; }
    public Employee? AssignedEmployee { get; set; }

    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
