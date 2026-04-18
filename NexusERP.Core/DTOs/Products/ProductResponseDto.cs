namespace NexusERP.Core.DTOs.Products;

public class ProductResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SKU { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public int MinimumStock { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool IsLowStock { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
