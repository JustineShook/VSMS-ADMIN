import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ClipboardCheck, CreditCard, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import { StatCard } from '../components/admin/StatCard';
import { BookingActivity } from '../components/admin/BookingActivity';
import { BookingTable } from '../components/admin/BookingTable';
import { VerificationTable } from '../components/admin/VerificationTable';
import { ProviderOverview } from '../components/admin/ProviderOverview';
import { bookingError, loadDashboardMetrics, type DashboardMetrics } from '../services/bookings';
const statIcons = [Users, ClipboardCheck, ShieldCheck, CalendarDays];
const statLabels = ['Total Users', 'Pending Verifications', 'Active Providers', 'Total Bookings'];
export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsError, setMetricsError] = useState('');
  const [metricsLoading, setMetricsLoading] = useState(true);
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError('');
    try { setMetrics(await loadDashboardMetrics()); }
    catch (error) { setMetricsError(bookingError(error)); }
    finally { setMetricsLoading(false); }
  }, []);
  useEffect(() => { void loadMetrics(); }, [loadMetrics]);
  const values = metrics ? [metrics.totalUsers, metrics.pendingVerifications, metrics.activeProviders, metrics.totalBookings] : [0, 0, 0, 0];
  const details = ['Registered accounts', 'Submitted applications awaiting review', 'Published provider listings', 'All recorded service requests'];
  return <div id="dashboard-top" className="space-y-6 scroll-mt-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">VERESC OPERATIONS</p><h2 className="text-2xl font-semibold tracking-tight">Overview</h2><p className="mt-2 text-xs text-slate-500">A clear view of your community, providers, and service activity.</p></div><span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><CalendarDays size={14} />September 10, 2026<span className="text-[9px] text-slate-400">SAMPLE</span></span></div>
    <div className="flex items-start gap-2.5 rounded-md border border-red-100 bg-red-50/50 px-4 py-3 text-xs leading-5 text-slate-600"><LayoutDashboard size={16} className="mt-0.5 shrink-0 text-brand" /><p><strong className="font-semibold text-brand">Dashboard data is connected.</strong> Summary metrics, provider verification, booking activity, recent bookings, and service-provider counts load from Firestore. Subscription earnings are a projection only.</p></div>
    {metricsError && <p role="alert" className="notice">{metricsError} <button className="ml-2 underline" onClick={() => void loadMetrics()}>Retry metrics</button></p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">{statLabels.map((label, index) => <StatCard key={label} id={index === 0 ? 'metric-users' : undefined} label={label} value={values[index].toLocaleString()} detail={details[index]} icon={statIcons[index]} attention={index === 1} loading={metricsLoading || !!metricsError} />)}<StatCard label="Potential Monthly Subscription Earnings" value={`₱${((metrics?.activeProviders ?? 0) * 500).toLocaleString()}`} detail={`Illustrative: ${metrics?.activeProviders ?? 0} active listings × ₱500/month; not collected revenue.`} icon={CreditCard} badge="MOCK" loading={metricsLoading || !!metricsError} /></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><BookingActivity /><ProviderOverview metrics={metrics} loading={metricsLoading || !!metricsError} /></div>
    <BookingTable /><VerificationTable />
    <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400"><span>VeResc Admin · Roadside assistance administration</span><span>Live verification · Other sections use sample data</span></footer>
  </div>;
}
