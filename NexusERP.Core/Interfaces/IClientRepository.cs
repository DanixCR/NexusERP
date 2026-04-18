using NexusERP.Core.DTOs.Clients;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface IClientRepository
{
    Task<Client?> GetByIdAsync(Guid id);
    Task<Client?> GetByTaxIdAsync(string taxId);
    Task<(IEnumerable<Client> Items, int TotalCount)> GetPagedAsync(ClientQueryParams query);
    Task CreateAsync(Client client);
    Task UpdateAsync(Client client);
    Task DeleteAsync(Client client);
}
