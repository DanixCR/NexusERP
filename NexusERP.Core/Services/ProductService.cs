using NexusERP.Core.DTOs.Products;
using NexusERP.Core.Entities;
using NexusERP.Core.Exceptions;
using NexusERP.Core.Interfaces;

namespace NexusERP.Core.Services;

public class ProductService
{
    private readonly IProductRepository _productRepository;

    public ProductService(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<(IEnumerable<ProductResponseDto> Items, int TotalCount)> GetPagedAsync(ProductQueryParams query)
    {
        var (items, total) = await _productRepository.GetPagedAsync(query);
        return (items.Select(MapToDto), total);
    }

    public async Task<IEnumerable<ProductResponseDto>> GetLowStockAsync()
    {
        var products = await _productRepository.GetLowStockAsync();
        return products.Select(MapToDto);
    }

    public async Task<ProductResponseDto> GetByIdAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Product {id} not found");

        return MapToDto(product);
    }

    public async Task<ProductResponseDto> CreateAsync(CreateProductDto dto)
    {
        var normalizedSku = dto.SKU.Trim().ToUpper();
        var existing = await _productRepository.GetBySkuAsync(normalizedSku);
        if (existing is not null)
            throw new ConflictException($"A product with SKU '{dto.SKU}' already exists");

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            SKU = normalizedSku,
            Price = dto.Price,
            Stock = dto.Stock,
            MinimumStock = dto.MinimumStock,
            Category = dto.Category.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _productRepository.CreateAsync(product);
        return MapToDto(product);
    }

    public async Task<ProductResponseDto> UpdateAsync(Guid id, UpdateProductDto dto)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Product {id} not found");

        var normalizedSku = dto.SKU.Trim().ToUpper();
        if (product.SKU != normalizedSku)
        {
            var existing = await _productRepository.GetBySkuAsync(normalizedSku);
            if (existing is not null)
                throw new ConflictException($"A product with SKU '{dto.SKU}' already exists");
        }

        product.Name = dto.Name.Trim();
        product.Description = dto.Description?.Trim();
        product.SKU = normalizedSku;
        product.Price = dto.Price;
        product.Stock = dto.Stock;
        product.MinimumStock = dto.MinimumStock;
        product.Category = dto.Category.Trim();
        product.UpdatedAt = DateTime.UtcNow;

        await _productRepository.UpdateAsync(product);
        return MapToDto(product);
    }

    public async Task DeleteAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"Product {id} not found");

        await _productRepository.DeleteAsync(product);
    }

    private static ProductResponseDto MapToDto(Product p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        SKU = p.SKU,
        Price = p.Price,
        Stock = p.Stock,
        MinimumStock = p.MinimumStock,
        Category = p.Category,
        IsLowStock = p.IsLowStock,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}
