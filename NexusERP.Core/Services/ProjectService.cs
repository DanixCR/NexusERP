using NexusERP.Core.DTOs.Projects;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class ProjectService
{
    private readonly IProjectRepository _projectRepository;
    private readonly IClientRepository _clientRepository;

    public ProjectService(IProjectRepository projectRepository, IClientRepository clientRepository)
    {
        _projectRepository = projectRepository;
        _clientRepository = clientRepository;
    }

    public async Task<(IEnumerable<ProjectResponseDto> Items, int TotalCount)> GetPagedAsync(ProjectQueryParams query)
    {
        var (items, total) = await _projectRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<ProjectResponseDto> GetByIdAsync(Guid id)
    {
        var project = await _projectRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Project {id} not found");

        return MapToDto(project);
    }

    public async Task<ProjectResponseDto> CreateAsync(CreateProjectDto dto)
    {
        var client = await _clientRepository.GetByIdAsync(dto.ClientId)
            ?? throw new NotFoundException($"Client {dto.ClientId} not found");

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            Status = ProjectStatus.Pending,
            StartDate = dto.StartDate,
            DueDate = dto.DueDate,
            Budget = dto.Budget,
            ClientId = client.Id,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _projectRepository.CreateAsync(project);

        // Asignar manualmente para que MapToDto acceda a Client.Name
        // sin necesidad de recargar desde la base de datos.
        project.Client = client;

        return MapToDto(project);
    }

    public async Task<ProjectResponseDto> UpdateAsync(Guid id, UpdateProjectDto dto)
    {
        var project = await _projectRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Project {id} not found");

        if (project.ClientId != dto.ClientId)
        {
            var newClient = await _clientRepository.GetByIdAsync(dto.ClientId)
                ?? throw new NotFoundException($"Client {dto.ClientId} not found");
            project.Client = newClient;
        }

        project.Name = dto.Name.Trim();
        project.Description = dto.Description?.Trim();
        project.Status = dto.Status;
        project.StartDate = dto.StartDate;
        project.DueDate = dto.DueDate;
        project.Budget = dto.Budget;
        project.ClientId = dto.ClientId;
        project.UpdatedAt = DateTime.UtcNow;

        await _projectRepository.UpdateAsync(project);
        return MapToDto(project);
    }

    public async Task DeleteAsync(Guid id)
    {
        var project = await _projectRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Project {id} not found");

        await _projectRepository.DeleteAsync(project);
    }

    private static ProjectResponseDto MapToDto(Project p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Status = p.Status.ToString(),
        StartDate = p.StartDate,
        DueDate = p.DueDate,
        Budget = p.Budget,
        ClientId = p.ClientId,
        ClientName = p.Client.Name,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}
