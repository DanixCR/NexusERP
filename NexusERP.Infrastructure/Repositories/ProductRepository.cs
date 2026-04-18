using Microsoft.EntityFrameworkCore;
using NexusERP.Core.DTOs.Products;
using NexusERP.Core.Entities;
using NexusERP.Core.Interfaces;
using NexusERP.Infrastructure.Data;

namespace NexusERP.Infrastructure.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly AppDbContext _context;

    public ProductRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Product?> GetByIdAsync(Guid id)
        => await _context.Products
            .Where(p => p.IsActive)
            .FirstOrDefaultAsync(p => p.Id == id);

    public async Task<Product?> GetBySkuAsync(string sku)
        => await _context.Products
            .Where(p => p.IsActive)
            .FirstOrDefaultAsync(p => p.SKU == sku);

    public async Task<(IEnumerable<Product> Items, int TotalCount)> GetPagedAsync(ProductQueryParams query)
    {
        var q = _context.Products.Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            q = q.Where(p =>
                p.Name.ToLower().Contains(search) ||
                p.SKU.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim().ToLower();
            q = q.Where(p => p.Category.ToLower() == category);
        }

        if (query.LowStockOnly)
        {
            q = q.Where(p => p.Stock < p.MinimumStock);
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderBy(p => p.Name)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<IEnumerable<Product>> GetLowStockAsync()
        => await _context.Products
            .Where(p => p.IsActive && p.Stock < p.MinimumStock)
            .OrderBy(p => p.Stock)
            .ToListAsync();

    public async Task CreateAsync(Product product)
    {
        await _context.Products.AddAsync(product);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Product product)
    {
        _context.Products.Update(product);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Product product)
    {
        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
