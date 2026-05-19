import { NavLink } from 'react-router-dom'
import { X, LayoutDashboard, Users, FolderKanban, UserRound, Package, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/clients',    label: 'Clientes',   icon: Users },
  { to: '/projects',   label: 'Proyectos',  icon: FolderKanban },
  { to: '/employees',  label: 'Empleados',  icon: UserRound },
  { to: '/products',   label: 'Inventario', icon: Package },
  { to: '/tickets',    label: 'Tickets',    icon: Ticket },
]

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center justify-between border-b px-6">
          <span className="text-lg font-bold tracking-tight">NexusERP</span>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <Separator />
        <p className="px-4 py-3 text-xs text-muted-foreground">v0.9.0</p>
      </aside>
    </>
  )
}
