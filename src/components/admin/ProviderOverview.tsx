import { Store, Truck, Wrench } from 'lucide-react';
import { providers } from '../../data/dashboardMock';
const icons = [Wrench, Store, Truck];
export function ProviderOverview() {
  return <section className="admin-panel">
    <div className="admin-section-heading"><div><h2>Service providers</h2><p>Your sample provider network</p></div></div>
    <div className="px-5 pb-5"><div className="mb-5 flex items-baseline gap-2"><strong className="text-3xl font-semibold tracking-tight">164</strong><span className="text-xs text-slate-400">active providers</span></div>
      <div className="space-y-5">{providers.map((provider, index) => {
        const Icon = icons[index];
        return <div key={provider.label}><div className="mb-2 flex items-center gap-2.5 text-xs"><Icon size={16} className="text-slate-400" /><span className="flex-1 text-slate-600">{provider.label}</span><strong className="font-semibold tabular-nums">{provider.count}</strong></div><div className="h-1.5 overflow-hidden rounded-sm bg-slate-100"><div className={index === 0 ? 'h-full bg-brand' : index === 1 ? 'h-full bg-red-300' : 'h-full bg-slate-300'} style={{ width: `${provider.percent}%` }} /></div></div>;
      })}</div>
    </div>
  </section>;
}
