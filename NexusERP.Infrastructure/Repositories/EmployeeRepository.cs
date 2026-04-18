using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Employees;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class EmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _context;

    public EmployeeRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Employee?> GetByIdAsync(Guid id)
        => await _context.Employees
            .Where(e => e.IsActive)
            .FirstOrDefaultAsync(e => e.Id == id);

    public async Task<Employee?> GetByEmailAsync(string email)
        => await _context.Employees
            .Where(e => e.IsActive)
            .FirstOrDefaultAsync(e => e.Email == email);

    public async Task<(IEnumerable<Employee> Items, int TotalCount)> GetPagedAsync(EmployeeQueryParams query)
    {
        var q = _context.Employees.Where(e => e.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(e =>
                e.FirstName.ToLower().Contains(search) ||
                e.LastName.ToLower().Contains(search) ||
                e.Position.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.Department))
        {
            var dept = query.Department.Trim().ToLower();
            q = q.Where(e => e.Department.ToLower() == dept);
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderBy(e => e.LastName)
            .ThenBy(e => e.FirstName)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task CreateAsync(Employee employee)
    {
        await _context.Employees.AddAsync(employee);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Employee employee)
    {
        _context.Employees.Update(employee);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Employee employee)
    {
        employee.IsActive = false;
        employee.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
