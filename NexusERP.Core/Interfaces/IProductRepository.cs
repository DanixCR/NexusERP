using NexusERP.Core.DTOs.Products;
using NexusERP.Core.Entities;

namespace NexusERP.Core.Interfaces;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id);
    Task<Product?> GetBySkuAsync(string sku);
    Task<(IEnumerable<Product> Items, int TotalCount)> GetPagedAsync(ProductQueryParams query);
    Task<IEnumerable<Product>> GetLowStockAsync();
    Task CreateAsync(Product product);
    Task UpdateAsync(Product product);
    Task DeleteAsync(Product product);
}
