import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-64 p-6">
        <Outlet />
      </main>
    </div>
  );
}
