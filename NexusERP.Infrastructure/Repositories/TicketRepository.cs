using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Tickets;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class TicketRepository : ITicketRepository
{
    private readonly AppDbContext _context;

    public TicketRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Ticket?> GetByIdAsync(Guid id)
        => await _context.Tickets
            .Include(t => t.Client)
            .Include(t => t.AssignedEmployee)
            .Where(t => t.IsActive)
            .FirstOrDefaultAsync(t => t.Id == id);

    public async Task<(IEnumerable<Ticket> Items, int TotalCount)> GetPagedAsync(TicketQueryParams query)
    {
        var q = _context.Tickets
            .Include(t => t.Client)
            .Include(t => t.AssignedEmployee)
            .Where(t => t.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(t => t.Title.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.Status) &&
            Enum.TryParse<TicketStatus>(query.Status, ignoreCase: true, out var status))
        {
            q = q.Where(t => t.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(query.Priority) &&
            Enum.TryParse<TicketPriority>(query.Priority, ignoreCase: true, out var priority))
        {
            q = q.Where(t => t.Priority == priority);
        }

        if (query.ClientId.HasValue)
            q = q.Where(t => t.ClientId == query.ClientId.Value);

        if (query.AssignedEmployeeId.HasValue)
            q = q.Where(t => t.AssignedEmployeeId == query.AssignedEmployeeId.Value);

        var total = await q.CountAsync();

        var items = await q
            .OrderByDescending(t => t.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task CreateAsync(Ticket ticket)
    {
        await _context.Tickets.AddAsync(ticket);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Ticket ticket)
    {
        _context.Tickets.Update(ticket);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Ticket ticket)
    {
        ticket.IsActive = false;
        ticket.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
