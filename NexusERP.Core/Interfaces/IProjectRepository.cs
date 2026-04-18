using NexusERP.Core.DTOs.Projects;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id);
    Task<(IEnumerable<Project> Items, int TotalCount)> GetPagedAsync(ProjectQueryParams query);
    Task CreateAsync(Project project);
    Task UpdateAsync(Project project);
    Task DeleteAsync(Project project);
}
