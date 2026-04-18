using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Projects;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class ProjectRepository : IProjectRepository
{
    private readonly AppDbContext _context;

    public ProjectRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Project?> GetByIdAsync(Guid id)
        => await _context.Projects
            .Include(p => p.Client)
            .Where(p => p.IsActive)
            .FirstOrDefaultAsync(p => p.Id == id);

    public async Task<(IEnumerable<Project> Items, int TotalCount)> GetPagedAsync(ProjectQueryParams query)
    {
        var q = _context.Projects
            .Include(p => p.Client)
            .Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(p =>
                p.Name.ToLower().Contains(search) ||
                (p.Description != null && p.Description.ToLower().Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(query.Status) &&
            Enum.TryParse<ProjectStatus>(query.Status, ignoreCase: true, out var status))
        {
            q = q.Where(p => p.Status == status);
        }

        if (query.ClientId.HasValue)
        {
            q = q.Where(p => p.ClientId == query.ClientId.Value);
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderByDescending(p => p.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task CreateAsync(Project project)
    {
        await _context.Projects.AddAsync(project);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Project project)
    {
        _context.Projects.Update(project);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Project project)
    {
        project.IsActive = false;
        project.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
