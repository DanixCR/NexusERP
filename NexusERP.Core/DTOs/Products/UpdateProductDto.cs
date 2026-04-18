namespace NexusERP.Core.DTOs.Products;

public class UpdateProductDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SKU { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public int MinimumStock { get; set; }
    public string Category { get; set; } = string.Empty;
}
