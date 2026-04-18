using NexusERP.Core.DTOs.Employees;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface IEmployeeRepository
{
    Task<Employee?> GetByIdAsync(Guid id);
    Task<Employee?> GetByEmailAsync(string email);
    Task<(IEnumerable<Employee> Items, int TotalCount)> GetPagedAsync(EmployeeQueryParams query);
    Task CreateAsync(Employee employee);
    Task UpdateAsync(Employee employee);
    Task DeleteAsync(Employee employee);
}
