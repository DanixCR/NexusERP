using NexusERP.Core.DTOs.Tickets;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface ITicketRepository
{
    Task<Ticket?> GetByIdAsync(Guid id);
    Task<(IEnumerable<Ticket> Items, int TotalCount)> GetPagedAsync(TicketQueryParams query);
    Task CreateAsync(Ticket ticket);
    Task UpdateAsync(Ticket ticket);
    Task DeleteAsync(Ticket ticket);
}
