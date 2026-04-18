namespace NexusERP.Core.DTOs.Projects;

public class ProjectQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public string? Status { get; set; }
    public Guid? ClientId { get; set; }
}
