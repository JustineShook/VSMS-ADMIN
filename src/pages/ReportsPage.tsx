import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, Download, Star, Users } from 'lucide-react';

type Range = '7 days' | '30 days' | '90 days';

const sample = {
  '7 days': {
    period: 'Oct 12–18, 2026',
    bookings: 186,
    completed: 148,
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    trend: [19, 24, 21, 29, 31, 34, 28],
    categories: [
      { label: 'Onsite Mechanics', value: 88, color: 'bg-brand' },
      { label: 'Auto Shops', value: 57, color: 'bg-red-300' },
      { label: 'Towing Companies', value: 41, color: 'bg-slate-400' },
    ],
  },
  '30 days': {
    period: 'Sep 19–Oct 18, 2026',
    bookings: 742,
    completed: 601,
    labels: ['Sep 19', 'Sep 24', 'Sep 29', 'Oct 04', 'Oct 09', 'Oct 14', 'Oct 18'],
    trend: [82, 94, 103, 111, 119, 126, 107],
    categories: [
      { label: 'Onsite Mechanics', value: 346, color: 'bg-brand' },
      { label: 'Auto Shops', value: 231, color: 'bg-red-300' },
      { label: 'Towing Companies', value: 165, color: 'bg-slate-400' },
    ],
  },
  '90 days': {
    period: 'Jul 21–Oct 18, 2026',
    bookings: 2148,
    completed: 1742,
    labels: ['Jul 21', 'Aug 05', 'Aug 20', 'Sep 04', 'Sep 19', 'Oct 04', 'Oct 18'],
    trend: [208, 243, 271, 296, 324, 385, 421],
    categories: [
      { label: 'Onsite Mechanics', value: 1004, color: 'bg-brand' },
      { label: 'Auto Shops', value: 669, color: 'bg-red-300' },
      { label: 'Towing Companies', value: 475, color: 'bg-slate-400' },
    ],
  },
} satisfies Record<Range, {
  period: string;
  bookings: number;
  completed: number;
  labels: string[];
  trend: number[];
  categories: { label: string; value: number; color: string }[];
}>;

function downloadCsv(range: Range, report: typeof sample[Range]) {
  const rows = [
    ['VeResc mock report', report.period],
    ['Metric', 'Sample value'],
    ['Bookings', String(report.bookings)],
    ['Completed bookings', String(report.completed)],
    ['Completion rate', `${Math.round(report.completed / report.bookings * 100)}%`],
    [],
    ['Provider category', 'Bookings'],
    ...report.categories.map(item => [item.label, String(item.value)]),
  ];
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `veresc-mock-report-${range.replace(' ', '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [range, setRange] = useState<Range>('30 days');
  const report = useMemo(() => sample[range], [range]);
  const maxTrend = Math.max(...report.trend);
  const completionRate = Math.round(report.completed / report.bookings * 100);
  const totalByCategory = report.categories.reduce((total, item) => total + item.value, 0);
  const chartAria = report.labels.map((label, index) => `${label}: ${report.trend[index]} bookings`).join(', ');

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">OPERATIONS INSIGHTS</p>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><BarChart3 size={23} className="text-brand" />Reports</h2>
        <p className="mt-2 text-xs text-slate-500">Sample booking and provider activity for presentation purposes.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          <CalendarDays size={14} />
          <span className="sr-only">Report period</span>
          <select className="bg-transparent outline-none" value={range} onChange={event => setRange(event.target.value as Range)}>
            <option value="7 days">Last 7 days</option><option value="30 days">Last 30 days</option><option value="90 days">Last 90 days</option>
          </select>
        </label>
        <button type="button" className="secondary inline-flex items-center gap-2" onClick={() => downloadCsv(range, report)}><Download size={14} />Export CSV</button>
      </div>
    </header>

    <div role="note" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <span><strong>MOCK REPORT</strong> — These figures are fictional examples and are not read from Firestore.</span>
      <span>{report.period}</span>
    </div>

    <section aria-label="Sample report summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Bookings" value={report.bookings.toLocaleString()} detail={`During ${range}`} icon={CalendarDays} />
      <MetricCard label="Completed" value={report.completed.toLocaleString()} detail={`${completionRate}% completion rate`} icon={CheckCircle2} />
      <MetricCard label="Active providers" value="164" detail="Across service categories" icon={Users} />
      <MetricCard label="Average rating" value="4.7 / 5" detail="Sample customer rating" icon={Star} />
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
      <section className="admin-panel min-w-0">
        <div className="admin-section-heading"><div><h3>Booking activity</h3><p>Sample bookings across the selected period</p></div><span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">MOCK</span></div>
        <div className="px-5 pb-5">
          <div className="mb-4 flex items-end justify-between"><strong className="text-3xl font-semibold tabular-nums">{report.bookings.toLocaleString()}</strong><span className="text-xs text-slate-400">total bookings</span></div>
          <div role="img" aria-label={`Mock booking activity: ${chartAria}.`} className="flex h-52 items-end gap-2 border-b border-slate-200 px-1 sm:gap-4">
            {report.trend.map((value, index) => <div key={report.labels[index]} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-5">
              <span className="text-[9px] font-medium text-slate-500">{value}</span>
              <div title={`${report.labels[index]}: ${value} bookings`} className={`w-full max-w-12 rounded-t-sm ${index === report.trend.length - 1 ? 'bg-brand' : 'bg-red-200'}`} style={{ height: `${Math.max(5, value / maxTrend * 70)}%` }} />
              <span className="absolute bottom-1 whitespace-nowrap text-[9px] text-slate-400">{report.labels[index]}</span>
            </div>)}
          </div>
          <p className="mt-4 text-[10px] text-slate-400">Each bar represents a sample interval, not a live count.</p>
        </div>
      </section>

      <section className="admin-panel min-w-0">
        <div className="admin-section-heading"><div><h3>Bookings by provider</h3><p>Sample category distribution</p></div><span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">MOCK</span></div>
        <div className="space-y-5 px-5 pb-5">
          {report.categories.map(item => {
            const percent = Math.round(item.value / totalByCategory * 100);
            return <div key={item.label}>
              <div className="mb-2 flex items-center gap-2 text-xs"><span className={`h-2.5 w-2.5 rounded-sm ${item.color}`} /><span className="flex-1 text-slate-600">{item.label}</span><strong>{item.value.toLocaleString()}</strong><span className="w-10 text-right text-slate-400">{percent}%</span></div>
              <div className="h-2 overflow-hidden rounded bg-slate-100"><div className={`h-full ${item.color}`} style={{ width: `${percent}%` }} /></div>
            </div>;
          })}
          <div className="border-t border-slate-100 pt-4 text-xs text-slate-500"><span>Total categorized bookings</span><strong className="float-right text-slate-800">{totalByCategory.toLocaleString()}</strong></div>
        </div>
      </section>
    </div>

    <section className="admin-panel overflow-hidden">
      <div className="admin-section-heading"><div><h3>Report notes</h3><p>Example operational summary</p></div></div>
      <div className="grid gap-4 px-5 pb-5 text-xs leading-5 text-slate-600 md:grid-cols-3">
        <p className="rounded border border-slate-100 p-4">Sample completion is {completionRate}%. Completed means a booking reached its completed status.</p>
        <p className="rounded border border-slate-100 p-4">Onsite Mechanics are the largest sample booking category in this report period.</p>
        <p className="rounded border border-slate-100 p-4">Replace these fixtures with an authorized live reporting query when report data is ready.</p>
      </div>
    </section>
  </div>;
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof CalendarDays }) {
  return <article className="admin-panel p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p></div><span className="rounded-md bg-slate-50 p-2 text-brand"><Icon size={18} /></span></div>
    <p className="mt-3 text-[10px] text-slate-400">{detail}</p>
  </article>;
}
