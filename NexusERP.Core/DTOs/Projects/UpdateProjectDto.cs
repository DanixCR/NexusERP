using NexusERP.Core.Entities;

namespace NexusERP.Core.DTOs.Projects;

public class UpdateProjectDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid ClientId { get; set; }
    public ProjectStatus Status { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal? Budget { get; set; }
}
