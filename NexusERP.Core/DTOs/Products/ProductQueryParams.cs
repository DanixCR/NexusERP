namespace NexusERP.Core.DTOs.Products;

public class ProductQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public string? Category { get; set; }
    public bool LowStockOnly { get; set; }
}
