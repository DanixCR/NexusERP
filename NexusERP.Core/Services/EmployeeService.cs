using NexusERP.Core.DTOs.Employees;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class EmployeeService
{
    private readonly IEmployeeRepository _employeeRepository;

    public EmployeeService(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    public async Task<(IEnumerable<EmployeeResponseDto> Items, int TotalCount)> GetPagedAsync(EmployeeQueryParams query)
    {
        var (items, total) = await _employeeRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<EmployeeResponseDto> GetByIdAsync(Guid id)
    {
        var employee = await _employeeRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Employee {id} not found");

        return MapToDto(employee);
    }

    public async Task<EmployeeResponseDto> CreateAsync(CreateEmployeeDto dto)
    {
        var existing = await _employeeRepository.GetByEmailAsync(dto.Email.Trim().ToLower());
        if (existing is not null)
            throw new ConflictException($"An employee with email '{dto.Email}' already exists");

        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            Email = dto.Email.Trim().ToLower(),
            Phone = dto.Phone?.Trim(),
            Position = dto.Position.Trim(),
            Department = dto.Department.Trim(),
            HireDate = dto.HireDate,
            Salary = dto.Salary,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _employeeRepository.CreateAsync(employee);
        return MapToDto(employee);
    }

    public async Task<EmployeeResponseDto> UpdateAsync(Guid id, UpdateEmployeeDto dto)
    {
        var employee = await _employeeRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Employee {id} not found");

        var normalizedEmail = dto.Email.Trim().ToLower();
        if (employee.Email != normalizedEmail)
        {
            var existing = await _employeeRepository.GetByEmailAsync(normalizedEmail);
            if (existing is not null)
                throw new ConflictException($"An employee with email '{dto.Email}' already exists");
        }

        employee.FirstName = dto.FirstName.Trim();
        employee.LastName = dto.LastName.Trim();
        employee.Email = normalizedEmail;
        employee.Phone = dto.Phone?.Trim();
        employee.Position = dto.Position.Trim();
        employee.Department = dto.Department.Trim();
        employee.HireDate = dto.HireDate;
        employee.Salary = dto.Salary;
        employee.UpdatedAt = DateTime.UtcNow;

        await _employeeRepository.UpdateAsync(employee);
        return MapToDto(employee);
    }

    public async Task DeleteAsync(Guid id)
    {
        var employee = await _employeeRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Employee {id} not found");

        await _employeeRepository.DeleteAsync(employee);
    }

    private static EmployeeResponseDto MapToDto(Employee e) => new()
    {
        Id = e.Id,
        FirstName = e.FirstName,
        LastName = e.LastName,
        FullName = $"{e.FirstName} {e.LastName}",
        Email = e.Email,
        Phone = e.Phone,
        Position = e.Position,
        Department = e.Department,
        HireDate = e.HireDate,
        Salary = e.Salary,
        IsActive = e.IsActive,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt
    };
}
