using NexusERP.Core.DTOs.Clients;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class ClientService
{
    private readonly IClientRepository _clientRepository;

    public ClientService(IClientRepository clientRepository)
    {
        _clientRepository = clientRepository;
    }

    public async Task<(IEnumerable<ClientResponseDto> Items, int TotalCount)> GetPagedAsync(ClientQueryParams query)
    {
        var (items, total) = await _clientRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<ClientResponseDto> GetByIdAsync(Guid id)
    {
        var client = await _clientRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Client {id} not found");

        return MapToDto(client);
    }

    public async Task<ClientResponseDto> CreateAsync(CreateClientDto dto)
    {
        var existing = await _clientRepository.GetByTaxIdAsync(dto.TaxId);
        if (existing != null)
            throw new ConflictException($"A client with TaxId '{dto.TaxId}' already exists");

        var client = new Client
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Email = dto.Email.Trim().ToLowerInvariant(),
            Phone = dto.Phone.Trim(),
            TaxId = dto.TaxId.Trim().ToUpperInvariant(),
            Address = dto.Address?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _clientRepository.CreateAsync(client);
        return MapToDto(client);
    }

    public async Task<ClientResponseDto> UpdateAsync(Guid id, UpdateClientDto dto)
    {
        var client = await _clientRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Client {id} not found");

        var existing = await _clientRepository.GetByTaxIdAsync(dto.TaxId);
        if (existing != null && existing.Id != id)
            throw new ConflictException($"A client with TaxId '{dto.TaxId}' already exists");

        client.Name = dto.Name.Trim();
        client.Email = dto.Email.Trim().ToLowerInvariant();
        client.Phone = dto.Phone.Trim();
        client.TaxId = dto.TaxId.Trim().ToUpperInvariant();
        client.Address = dto.Address?.Trim();
        client.UpdatedAt = DateTime.UtcNow;

        await _clientRepository.UpdateAsync(client);
        return MapToDto(client);
    }

    public async Task DeleteAsync(Guid id)
    {
        var client = await _clientRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Client {id} not found");

        await _clientRepository.DeleteAsync(client);
    }

    private static ClientResponseDto MapToDto(Client c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Email = c.Email,
        Phone = c.Phone,
        TaxId = c.TaxId,
        Address = c.Address,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };
}
