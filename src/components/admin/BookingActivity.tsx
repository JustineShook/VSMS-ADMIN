import { CalendarDays } from 'lucide-react';
import { activity } from '../../data/dashboardMock';
export function BookingActivity() {
  const total = activity.reduce((sum, entry) => sum + entry.count, 0);
  return <section className="admin-panel min-w-0">
    <div className="admin-section-heading"><div><h2>Booking activity</h2><p>Service requests over the last 7 sample days</p></div><span className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1.5 text-[10px] text-slate-500"><CalendarDays size={12} />Sep 04 – 10</span></div>
    <div className="px-5 pb-5"><div className="mb-5 flex items-end justify-between gap-3"><div><span className="text-3xl font-semibold tracking-tight tabular-nums">{total}</span><span className="ml-2 text-xs text-slate-400">bookings this week</span></div><span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-sm bg-brand" />Bookings</span></div>
      <div role="img" aria-label={`Sample booking activity: ${activity.map(item => `${item.date}: ${item.count} bookings`).join(', ')}.`} className="relative h-44 pl-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">{[80, 60, 40, 20, 0].map(tick => <div key={tick} className="flex items-center gap-2"><span className="w-5 text-right text-[9px] text-slate-400">{tick}</span><span className="flex-1 border-t border-dashed border-slate-200" /></div>)}</div>
        <div className="relative flex h-full justify-around gap-2">{activity.map((item, index) => <div key={item.day} className="flex h-full min-w-0 flex-1 flex-col items-center"><div className="flex w-full flex-1 items-end justify-center pb-px"><div title={`${item.date}: ${item.count} bookings`} className={`relative w-full max-w-10 rounded-t-sm ${index === 5 ? 'bg-brand' : 'bg-red-200'}`} style={{ height: `${item.count / 80 * 100}%` }}><span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-medium text-slate-500">{item.count}</span></div></div><span className="flex h-6 items-end text-[10px] text-slate-400">{item.day}</span></div>)}</div>
      </div>
    </div>
  </section>;
}
