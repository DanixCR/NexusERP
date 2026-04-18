using Microsoft.EntityFrameworkCore;
using NexusERP.Core.Entities;

namespace NexusERP.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Ticket> Tickets => Set<Ticket>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Id).ValueGeneratedNever();
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Email).HasMaxLength(256).IsRequired();
            entity.Property(u => u.PasswordHash).IsRequired();
            entity.Property(u => u.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(u => u.LastName).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<Client>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Id).ValueGeneratedNever();
            entity.HasIndex(c => c.TaxId).IsUnique();
            entity.Property(c => c.Name).HasMaxLength(200).IsRequired();
            entity.Property(c => c.Email).HasMaxLength(256).IsRequired();
            entity.Property(c => c.Phone).HasMaxLength(50).IsRequired();
            entity.Property(c => c.TaxId).HasMaxLength(50).IsRequired();
            entity.Property(c => c.Address).HasMaxLength(500);
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).ValueGeneratedNever();
            entity.Property(p => p.Name).HasMaxLength(300).IsRequired();
            entity.Property(p => p.Description).HasMaxLength(2000);
            entity.Property(p => p.Status)
                  .HasConversion<string>()
                  .HasMaxLength(30)
                  .IsRequired();
            entity.Property(p => p.Budget)
                  .HasColumnType("decimal(18,2)");
            entity.HasOne(p => p.Client)
                  .WithMany()
                  .HasForeignKey(p => p.ClientId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(200).IsRequired();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Phone).HasMaxLength(30);
            entity.Property(e => e.Position).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Department).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Salary).HasColumnType("decimal(18,2)");
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).ValueGeneratedNever();
            entity.Property(p => p.Name).HasMaxLength(300).IsRequired();
            entity.Property(p => p.Description).HasMaxLength(2000);
            entity.Property(p => p.SKU).HasMaxLength(100).IsRequired();
            entity.HasIndex(p => p.SKU).IsUnique();
            entity.Property(p => p.Price).HasColumnType("decimal(18,2)");
            entity.Property(p => p.Category).HasMaxLength(200).IsRequired();
            entity.Ignore(p => p.IsLowStock);
        });

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Id).ValueGeneratedNever();
            entity.Property(t => t.Title).HasMaxLength(500).IsRequired();
            entity.Property(t => t.Description).HasMaxLength(4000).IsRequired();
            entity.Property(t => t.Priority)
                  .HasConversion<string>()
                  .HasMaxLength(20)
                  .IsRequired();
            entity.Property(t => t.Status)
                  .HasConversion<string>()
                  .HasMaxLength(20)
                  .IsRequired();
            entity.Property(t => t.Category).HasMaxLength(200).IsRequired();

            entity.HasOne(t => t.Client)
                  .WithMany()
                  .HasForeignKey(t => t.ClientId)
                  .OnDelete(DeleteBehavior.Restrict)
                  .IsRequired(false);

            entity.HasOne(t => t.AssignedEmployee)
                  .WithMany()
                  .HasForeignKey(t => t.AssignedEmployeeId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Id).ValueGeneratedNever();
            entity.HasIndex(t => t.Token);
            entity.Property(t => t.Token).IsRequired();
            entity.Ignore(t => t.IsActive); // Propiedad calculada, no se persiste en DB
            entity.HasOne(t => t.User)
                  .WithMany(u => u.RefreshTokens)
                  .HasForeignKey(t => t.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
