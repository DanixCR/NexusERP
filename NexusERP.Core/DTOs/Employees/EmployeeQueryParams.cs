namespace NexusERP.Core.DTOs.Employees;

public class EmployeeQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public string? Department { get; set; }
}
