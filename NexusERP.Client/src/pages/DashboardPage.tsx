import { useNavigate } from 'react-router-dom'
import { Users, FolderKanban, UserRound, Package, Ticket } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const modules = [
  { to: '/clients',   icon: Users,         title: 'Clientes',   description: 'Gestión de clientes y contactos' },
  { to: '/projects',  icon: FolderKanban,  title: 'Proyectos',  description: 'Seguimiento de proyectos activos' },
  { to: '/employees', icon: UserRound,     title: 'Empleados',  description: 'Recursos humanos y nómina' },
  { to: '/products',  icon: Package,       title: 'Inventario', description: 'Control de stock y productos' },
  { to: '/tickets',   icon: Ticket,        title: 'Tickets',    description: 'Soporte y gestión de incidencias' },
]

export function DashboardPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Bienvenido a NexusERP</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map(({ to, icon: Icon, title, description }) => (
          <Card
            key={to}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => navigate(to)}
          >
            <CardHeader>
              <Icon className="mb-1 h-7 w-7 text-primary" />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
