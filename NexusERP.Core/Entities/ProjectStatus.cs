namespace NexusERP.Core.Entities;

public enum ProjectStatus
{
    Pending,      // Pendiente — creado pero no iniciado
    InProgress,   // En progreso — trabajo activo
    Completed,    // Completado — entregado y cerrado
    Cancelled     // Cancelado — no se continuará
}
