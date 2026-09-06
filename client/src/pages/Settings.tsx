import { OdooSettings } from '@/components/settings/OdooSettings';

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Odoo connection, sync, foam vendor and waste allowance. Slab sizes live on each foam under Foam Slabs.</p>
      </div>
      <OdooSettings />
    </div>
  );
}
