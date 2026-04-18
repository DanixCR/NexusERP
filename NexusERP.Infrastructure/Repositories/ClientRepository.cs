using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Clients;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly AppDbContext _context;

    public ClientRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Client?> GetByIdAsync(Guid id)
        => await _context.Clients
            .Where(c => c.IsActive)
            .FirstOrDefaultAsync(c => c.Id == id);

    public async Task<Client?> GetByTaxIdAsync(string taxId)
        => await _context.Clients
            .Where(c => c.IsActive)
            .FirstOrDefaultAsync(c => c.TaxId == taxId.ToUpperInvariant());

    public async Task<(IEnumerable<Client> Items, int TotalCount)> GetPagedAsync(ClientQueryParams query)
    {
        var q = _context.Clients.Where(c => c.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(c =>
                c.Name.ToLower().Contains(search) ||
                c.Email.ToLower().Contains(search) ||
                c.TaxId.ToLower().Contains(search));
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderBy(c => c.Name)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task CreateAsync(Client client)
    {
        await _context.Clients.AddAsync(client);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Client client)
    {
        _context.Clients.Update(client);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Client client)
    {
        client.IsActive = false;
        client.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
