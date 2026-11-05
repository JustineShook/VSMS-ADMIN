import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ClipboardCheck, CreditCard, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import { StatCard } from '../components/admin/StatCard';
import { BookingActivity } from '../components/admin/BookingActivity';
import { BookingTable } from '../components/admin/BookingTable';
import { VerificationTable } from '../components/admin/VerificationTable';
import { ProviderOverview } from '../components/admin/ProviderOverview';
import { bookingError, loadDashboardMetrics, loadDemoDashboardMetrics, type DashboardMetrics, type DemoDashboardMetrics } from '../services/bookings';
const statIcons = [Users, ClipboardCheck, ShieldCheck, CalendarDays];
const statLabels = ['Total Users', 'Pending Verifications', 'Active Providers', 'Total Bookings'];
export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsError, setMetricsError] = useState('');
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [demoMetrics, setDemoMetrics] = useState<DemoDashboardMetrics | null>(null);
  const [demoError, setDemoError] = useState('');
  const [demoLoading, setDemoLoading] = useState(true);
  const loadDemoMetrics = useCallback(async () => {
    setDemoLoading(true);
    setDemoError('');
    setDemoMetrics(null);
    try { setDemoMetrics(await loadDemoDashboardMetrics()); }
    catch (error) { setDemoError(bookingError(error)); }
    finally { setDemoLoading(false); }
  }, []);
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError('');
    setMetrics(null);
    try { setMetrics(await loadDashboardMetrics()); }
    catch (error) { setMetricsError(bookingError(error)); }
    finally { setMetricsLoading(false); }
  }, []);
  useEffect(() => { void loadMetrics(); }, [loadMetrics]);
  useEffect(() => { void loadDemoMetrics(); }, [loadDemoMetrics]);
  const values = metrics ? [metrics.totalUsers, metrics.pendingVerifications, metrics.activeProviders, metrics.totalBookings] : [0, 0, 0, 0];
  const details = ['Registered accounts', 'Submitted applications awaiting review', 'Published listings across all four provider roles, including Home Garage', 'All recorded service requests; parking excluded'];
  return <div id="dashboard-top" className="space-y-6 scroll-mt-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">VERESC OPERATIONS</p><h2 className="text-2xl font-semibold tracking-tight">Overview</h2><p className="mt-2 text-xs text-slate-500">A clear view of your community, providers, and service activity.</p></div><span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><CalendarDays size={14} />{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date())}<span className="text-[9px] text-slate-400">PH TIME</span></span></div>
    <div className="flex items-start gap-2.5 rounded-md border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs leading-5 text-slate-600"><LayoutDashboard size={16} className="mt-0.5 shrink-0 text-brand" /><p><strong className="font-semibold text-brand">Dashboard data is connected.</strong> Summary metrics, provider verification, booking activity, recent bookings, and service-provider counts load from Firestore.</p></div>
    {metricsError && <p role="alert" className="notice">{metricsError} <button className="ml-2 underline" onClick={() => void loadMetrics()}>Retry metrics</button></p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statLabels.map((label, index) => <StatCard key={label} id={index === 0 ? 'metric-users' : undefined} label={label} value={metricsLoading ? 'Loading…' : metricsError || !metrics ? 'Unavailable' : values[index].toLocaleString()} detail={details[index]} icon={statIcons[index]} attention={index === 1} />)}</div>
    <section aria-label="Subscription metrics" aria-busy={demoLoading} className="space-y-3">
      <p className="text-xs font-medium text-amber-800">Demo only—no real money collected.</p>
      {demoError && <p role="alert" className="notice">Subscription metrics unavailable: {demoError} <button className="ml-2 underline" onClick={() => void loadDemoMetrics()}>Retry subscription metrics</button></p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Demo collections this month"
          value={demoLoading ? 'Loading…' : demoError || !demoMetrics ? 'Unavailable' : `₱${demoMetrics.collectionsThisMonth.toLocaleString('en-PH')}`}
          detail={demoMetrics ? `${demoMetrics.monthLabel} · Philippine time. Full monthly and yearly simulated amounts recorded this month.` : 'Philippine calendar month. Includes successful simulated activations and renewals.'}
          icon={CreditCard} badge={null} />
        <StatCard label="Active demo subscriptions"
          value={demoLoading ? 'Loading…' : demoError || !demoMetrics ? 'Unavailable' : demoMetrics.activeSubscriptions.toLocaleString('en-PH')}
          detail="Provider demo subscriptions with an expiry later than the time of the last successful load."
          icon={ShieldCheck} badge={null} />
      </div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><BookingActivity /><ProviderOverview metrics={metrics} loading={metricsLoading} error={metricsError} /></div>
    <BookingTable /><VerificationTable />
    <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400"><span>VeResc Admin · Roadside assistance administration</span><span>Service bookings exclude parking sessions; demo collections are simulated</span></footer>
  </div>;
}
