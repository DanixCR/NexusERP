using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusERP.Core.DTOs.Products;
using NexusERP.Core.Services;

namespace NexusERP.API.Controllers;

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ProductService _productService;

    public ProductsController(ProductService productService)
    {
        _productService = productService;
    }

    // GET /api/products?page=1&pageSize=20&search=laptop&category=Electronica&lowStockOnly=true
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ProductQueryParams query)
    {
        var (items, total) = await _productService.GetPagedAsync(query);
        return Ok(new
        {
            items,
            totalCount = total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling((double)total / query.PageSize)
        });
    }

    // GET /api/products/low-stock
    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStock()
    {
        var products = await _productService.GetLowStockAsync();
        return Ok(products);
    }

    // GET /api/products/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var product = await _productService.GetByIdAsync(id);
        return Ok(product);
    }

    // POST /api/products
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductDto dto)
    {
        var product = await _productService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    // PUT /api/products/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductDto dto)
    {
        var product = await _productService.UpdateAsync(id, dto);
        return Ok(product);
    }

    // DELETE /api/products/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _productService.DeleteAsync(id);
        return NoContent();
    }
}
