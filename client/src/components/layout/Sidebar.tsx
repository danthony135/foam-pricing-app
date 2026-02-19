import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Box, Layers, Users, Calculator,
  FileText, Package, Settings, MessageSquare, Import,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/foams', icon: Box, label: 'Foam Library' },
  { to: '/dacrons', icon: Layers, label: 'Dacron Library' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/calculator', icon: Calculator, label: 'Pricing Calculator' },
  { to: '/quotes', icon: FileText, label: 'Quotes' },
  { to: '/import-quotes', icon: Import, label: 'Import Quotes' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/ai', icon: MessageSquare, label: 'AI Chat' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-14 items-center border-b px-6">
        <h1 className="text-lg font-bold">Foam Pricing</h1>
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
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
