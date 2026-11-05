import { House, Store, Truck, Wrench } from 'lucide-react';
import type { DashboardMetrics } from '../../services/bookings';

const entries = [
  { role: 'onsite-mechanic', label: 'Onsite Mechanics', Icon: Wrench },
  { role: 'shop-owner', label: 'Auto Shops', Icon: Store },
  { role: 'towing-company', label: 'Towing Companies', Icon: Truck },
  { role: 'homegarage', label: 'Home Garages', Icon: House },
];

export function ProviderOverview({ metrics, loading, error = '' }: { metrics: DashboardMetrics | null; loading: boolean; error?: string }) {
  const counts = new Map(metrics?.providersByType.map(item => [item.role, item.count]) ?? []);
  const total = metrics?.activeProviders ?? 0;
  return <section className="admin-panel">
    <div className="admin-section-heading"><div><h2>Service providers <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-brand">LIVE FIRESTORE</span></h2><p>Listings with visibility set to active, across all four provider roles</p></div></div>
    <div className="px-5 pb-5"><div className="mb-5 flex items-baseline gap-2"><strong className="text-3xl font-semibold tracking-tight">{loading ? 'Loading…' : error || !metrics ? 'Unavailable' : total.toLocaleString()}</strong><span className="text-xs text-slate-400">active providers</span></div>
      {!loading && error && <p role="alert" className="mb-4 text-xs text-red-700">Provider counts unavailable. Use Retry metrics above.</p>}
      {!loading && !error && metrics && total === 0 && <p role="status" className="mb-4 text-xs text-slate-500">No published providers found.</p>}
      <div className="space-y-5">{entries.map(({ role, label, Icon }, index) => {
        const count = counts.get(role) ?? 0;
        const percent = !loading && !error && metrics && total ? count / total * 100 : 0;
        return <div id={`provider-${role}`} key={role} className="scroll-mt-6"><div className="mb-2 flex items-center gap-2.5 text-xs"><Icon size={16} className="text-slate-400" /><span className="flex-1 text-slate-600">{label}</span><strong className="font-semibold tabular-nums">{loading ? 'Loading…' : error || !metrics ? 'Unavailable' : count.toLocaleString()}</strong></div><div className="h-1.5 overflow-hidden rounded-sm bg-slate-100"><div className={index === 0 ? 'h-full bg-brand' : index === 1 ? 'h-full bg-blue-300' : 'h-full bg-slate-300'} style={{ width: `${percent}%` }} /></div></div>;
      })}</div>
    </div>
  </section>;
}
