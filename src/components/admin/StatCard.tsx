import type { LucideIcon } from 'lucide-react';
interface Props { label: string; value: string; detail: string; icon: LucideIcon; attention?: boolean; loading?: boolean; id?: string; badge?: 'LIVE' | 'MOCK' }
export function StatCard({ label, value, detail, icon: Icon, attention = false, loading = false, id, badge = 'LIVE' }: Props) {
  const badgeStyle = badge === 'MOCK' ? 'bg-amber-50 text-amber-800' : attention ? 'bg-red-50 text-brand' : 'bg-slate-50 text-slate-600';
  return <article id={id} className="admin-panel scroll-mt-6 p-5">
    <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-medium text-slate-500">{label}</h3><Icon size={18} strokeWidth={1.7} className={attention ? 'text-brand' : 'text-slate-400'} /></div>
    <div className="mt-4 flex flex-wrap items-end gap-3"><p className="text-[30px] font-semibold leading-none tracking-tight tabular-nums">{loading ? '—' : value}</p><span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-[10px] font-medium ${badgeStyle}`}>{badge}</span></div>
    <p className="mt-3 text-[11px] text-slate-400">{detail}</p>
  </article>;
}
