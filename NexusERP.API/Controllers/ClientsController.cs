using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Clients;
using NexusERP.Core.Services;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/clients")]
[Authorize]
public class ClientsController : ControllerBase
{
    private readonly ClientService _clientService;

    public ClientsController(ClientService clientService)
    {
        _clientService = clientService;
    }

    // GET /api/clients?page=1&pageSize=20&search=abc
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ClientQueryParams query)
    {
        var (items, total) = await _clientService.GetPagedAsync(query);
        return Ok(new
        {
            items,
            totalCount = total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling((double)total / query.PageSize)
        });
    }

    // GET /api/clients/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var client = await _clientService.GetByIdAsync(id);
        return Ok(client);
    }

    // POST /api/clients
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateClientDto dto)
    {
        var client = await _clientService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = client.Id }, client);
    }

    // PUT /api/clients/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateClientDto dto)
    {
        var client = await _clientService.UpdateAsync(id, dto);
        return Ok(client);
    }

    // DELETE /api/clients/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _clientService.DeleteAsync(id);
        return NoContent();
    }
}
