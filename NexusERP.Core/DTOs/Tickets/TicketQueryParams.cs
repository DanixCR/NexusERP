namespace NexusERP.Core.DTOs.Tickets;

public class TicketQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public Guid? ClientId { get; set; }
    public Guid? AssignedEmployeeId { get; set; }
}
