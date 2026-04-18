using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Employees;
using NexusERP.Core.Services;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly EmployeeService _employeeService;

    public EmployeesController(EmployeeService employeeService)
    {
        _employeeService = employeeService;
    }

    // GET /api/employees?page=1&pageSize=20&search=juan&department=IT
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] EmployeeQueryParams query)
    {
        var (items, total) = await _employeeService.GetPagedAsync(query);
        return Ok(new
        {
            items,
            totalCount = total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling((double)total / query.PageSize)
        });
    }

    // GET /api/employees/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var employee = await _employeeService.GetByIdAsync(id);
        return Ok(employee);
    }

    // POST /api/employees
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeDto dto)
    {
        var employee = await _employeeService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = employee.Id }, employee);
    }

    // PUT /api/employees/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeDto dto)
    {
        var employee = await _employeeService.UpdateAsync(id, dto);
        return Ok(employee);
    }

    // DELETE /api/employees/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _employeeService.DeleteAsync(id);
        return NoContent();
    }
}
