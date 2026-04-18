using NexusERP.Core.DTOs.Tickets;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class TicketService
{
    private readonly ITicketRepository _ticketRepository;

    public TicketService(ITicketRepository ticketRepository)
    {
        _ticketRepository = ticketRepository;
    }

    public async Task<(IEnumerable<TicketResponseDto> Items, int TotalCount)> GetPagedAsync(TicketQueryParams query)
    {
        var (items, total) = await _ticketRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<TicketResponseDto> GetByIdAsync(Guid id)
    {
        var ticket = await _ticketRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Ticket {id} not found");

        return MapToDto(ticket);
    }

    public async Task<TicketResponseDto> CreateAsync(CreateTicketDto dto)
    {
        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            Title = dto.Title.Trim(),
            Description = dto.Description.Trim(),
            Priority = dto.Priority,
            Status = TicketStatus.Open,
            Category = dto.Category.Trim(),
            ClientId = dto.ClientId,
            AssignedEmployeeId = dto.AssignedEmployeeId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _ticketRepository.CreateAsync(ticket);
        return await GetByIdAsync(ticket.Id);
    }

    public async Task<TicketResponseDto> UpdateAsync(Guid id, UpdateTicketDto dto)
    {
        var ticket = await _ticketRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Ticket {id} not found");

        ticket.Title = dto.Title.Trim();
        ticket.Description = dto.Description.Trim();
        ticket.Priority = dto.Priority;
        ticket.Category = dto.Category.Trim();
        ticket.ClientId = dto.ClientId;
        ticket.AssignedEmployeeId = dto.AssignedEmployeeId;
        ticket.UpdatedAt = DateTime.UtcNow;

        await _ticketRepository.UpdateAsync(ticket);
        return await GetByIdAsync(ticket.Id);
    }

    public async Task<TicketResponseDto> ChangeStatusAsync(Guid id, ChangeTicketStatusDto dto)
    {
        var ticket = await _ticketRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Ticket {id} not found");

        ticket.Status = dto.Status;
        ticket.UpdatedAt = DateTime.UtcNow;

        await _ticketRepository.UpdateAsync(ticket);
        return await GetByIdAsync(ticket.Id);
    }

    public async Task DeleteAsync(Guid id)
    {
        var ticket = await _ticketRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Ticket {id} not found");

        await _ticketRepository.DeleteAsync(ticket);
    }

    private static TicketResponseDto MapToDto(Ticket t) => new()
    {
        Id = t.Id,
        Title = t.Title,
        Description = t.Description,
        Priority = t.Priority.ToString(),
        Status = t.Status.ToString(),
        Category = t.Category,
        ClientId = t.ClientId,
        ClientName = t.Client?.Name,
        AssignedEmployeeId = t.AssignedEmployeeId,
        AssignedEmployeeName = t.AssignedEmployee != null
            ? $"{t.AssignedEmployee.FirstName} {t.AssignedEmployee.LastName}"
            : null,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt
    };
}
