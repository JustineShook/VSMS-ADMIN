import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { bookingError, loadBookingActivity, type BookingActivityDay } from '../../services/bookings';

const dayLabel = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short' });
const dateLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
const fullDateLabel = (date: Date) => date.toLocaleDateString(undefined, { dateStyle: 'medium' });

export function BookingActivity() {
  const [activity, setActivity] = useState<BookingActivityDay[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setActivity(await loadBookingActivity()); }
    catch (err) { setError(bookingError(err)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const total = activity.reduce((sum, entry) => sum + entry.count, 0);
  const max = Math.max(1, ...activity.map(entry => entry.count));
  const axisMax = Math.max(4, Math.ceil(max / 4) * 4);
  const ticks = [axisMax, Math.round(axisMax * 0.75), Math.round(axisMax * 0.5), Math.round(axisMax * 0.25), 0];
  const range = activity.length ? `${dateLabel(activity[0].date)} – ${dateLabel(activity[activity.length - 1].date)}` : '';

  return <section id="booking-activity" className="admin-panel min-w-0 scroll-mt-6">
    <div className="admin-section-heading"><div><h2>Booking activity <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-brand">LIVE FIRESTORE</span></h2><p>Bookings created over the last 7 days</p></div><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1.5 text-[10px] text-slate-500"><CalendarDays size={12} />{range || 'Last 7 days'}</span><button className="admin-icon" onClick={() => void load()} disabled={busy} aria-label="Refresh booking activity"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /></button></div></div>
    {error && <p role="alert" className="notice mx-5 mb-4">{error}</p>}
    {busy && <p role="status" className="px-5 pb-4 text-sm text-slate-500">Loading booking activity…</p>}
    {!busy && !error && <div className="px-5 pb-5"><div className="mb-5 flex items-end justify-between gap-3"><div><span className="text-3xl font-semibold tracking-tight tabular-nums">{total}</span><span className="ml-2 text-xs text-slate-400">bookings this week</span></div><span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-sm bg-brand" />Bookings</span></div>
      {activity.length > 0 ? <div role="img" aria-label={`Live booking activity: ${activity.map(item => `${fullDateLabel(item.date)}: ${item.count} bookings`).join(', ')}.`} className="relative h-44 pl-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">{ticks.map(tick => <div key={tick} className="flex items-center gap-2"><span className="w-5 text-right text-[9px] text-slate-400">{tick}</span><span className="flex-1 border-t border-dashed border-slate-200" /></div>)}</div>
        <div className="relative flex h-full justify-around gap-2">{activity.map((item, index) => <div key={item.date.toISOString()} className="flex h-full min-w-0 flex-1 flex-col items-center"><div className="flex w-full flex-1 items-end justify-center pb-px"><div title={`${fullDateLabel(item.date)}: ${item.count} bookings`} className={`relative w-full max-w-10 rounded-t-sm ${index === activity.length - 1 ? 'bg-brand' : 'bg-red-200'}`} style={{ height: `${item.count ? Math.max(2, item.count / axisMax * 100) : 0}%` }}><span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-medium text-slate-500">{item.count}</span></div></div><span className="flex h-6 items-end text-[10px] text-slate-400">{dayLabel(item.date)}</span></div>)}</div>
      </div> : <p className="py-8 text-center text-sm text-slate-500">No bookings were created in this period.</p>}
    </div>}
  </section>;
}
