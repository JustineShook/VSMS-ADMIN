import { CalendarDays, ClipboardCheck, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import { stats } from '../data/dashboardMock';
import { StatCard } from '../components/admin/StatCard';
import { BookingActivity } from '../components/admin/BookingActivity';
import { BookingTable } from '../components/admin/BookingTable';
import { VerificationTable } from '../components/admin/VerificationTable';
import { ProviderOverview } from '../components/admin/ProviderOverview';
const statIcons = [Users, ClipboardCheck, ShieldCheck, CalendarDays];
export function DashboardPage() {
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">VERESC OPERATIONS</p><h2 className="text-2xl font-semibold tracking-tight">Overview</h2><p className="mt-2 text-xs text-slate-500">A clear view of your community, providers, and service activity.</p></div><span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><CalendarDays size={14} />September 10, 2026<span className="text-[9px] text-slate-400">SAMPLE</span></span></div>
    <div className="flex items-start gap-2.5 rounded-md border border-red-100 bg-red-50/50 px-4 py-3 text-xs leading-5 text-slate-600"><LayoutDashboard size={16} className="mt-0.5 shrink-0 text-brand" /><p><strong className="font-semibold text-brand">Provider verification is live.</strong> The verification queue below uses real applications and saves real decisions. Summary cards, booking activity, service-provider counts, and bookings remain fictional sample data.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat, index) => <StatCard key={stat.label} {...stat} icon={statIcons[index]} attention={index === 1} />)}</div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><BookingActivity /><ProviderOverview /></div>
    <BookingTable /><VerificationTable />
    <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400"><span>VeResc Admin · Roadside assistance administration</span><span>Live verification · Other sections use sample data</span></footer>
  </div>;
}
