import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Box, Layers, Package, Settings, Tags, Scissors, Monitor, Recycle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/skus', icon: Tags, label: 'SKUs & Patterns' },
  { to: '/foam-orders', icon: Scissors, label: 'Foam Orders / Nests' },
  { to: '/cut-station', icon: Monitor, label: 'Cut Station' },
  { to: '/foams', icon: Box, label: 'Foam Slabs' },
  { to: '/dacrons', icon: Layers, label: 'Dacron' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/scrap', icon: Recycle, label: 'Scrap by slab type' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-14 items-center border-b px-6">
        <h1 className="text-lg font-bold">Foam App</h1>
      </div>
      <nav className="space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="absolute inset-x-0 bottom-0 border-t p-4 text-xs text-muted-foreground">CP Furniture Manufacturing · foam patterns, nests, cut station</div>
    </aside>
  );
}
