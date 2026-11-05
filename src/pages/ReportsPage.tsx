import { useEffect, useState } from 'react';
import { completionPercent, formatReportRating, reportCsv, loadActivityReport, type ActivityReport, type ReportRange } from '../services/reports';
import { bookingError } from '../services/bookings';
import { BarChart3, CalendarDays, CheckCircle2, Download, Star, Users } from 'lucide-react';

function downloadCsv(range: ReportRange, report: ActivityReport) {
  const csv = reportCsv(report);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `veresc-report-${range.replace(' ', '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [range, setRange] = useState<ReportRange>('30 days');
  const [result, setResult] = useState<{ range: ReportRange; report: ActivityReport } | null>(null);
  const [failure, setFailure] = useState<{ range: ReportRange; message: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setFailure(null);
    void loadActivityReport(range).then(report => {
      if (active) setResult({ range, report });
    }, error => {
      if (active) setFailure({ range, message: bookingError(error) });
    });
    return () => { active = false; };
  }, [range, refresh]);
  const report = result?.range === range ? result.report : null;
  const error = failure?.range === range ? failure.message : '';
  const maxTrend = Math.max(1, ...(report?.trend ?? []));
  const completionRate = report ? completionPercent(report) : 0;
  const totalByCategory = report?.categories.reduce((total, item) => total + item.value, 0) ?? 0;
  const chartAria = report?.intervals.map((label, index) => `${label}: ${report.trend[index]} bookings`).join(', ') ?? '';
  const largest = report?.categories.reduce<ActivityReport['categories'][number] | null>((best, item) => !best || item.value > best.value ? item : best, null);

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">OPERATIONS INSIGHTS</p>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><BarChart3 size={23} className="text-brand" />Reports</h2>
        <p className="mt-2 text-xs text-slate-500">Booking activity and customer reviews from recorded service data.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          <CalendarDays size={14} />
          <span className="sr-only">Report period</span>
          <select className="bg-transparent outline-none" value={range} onChange={event => setRange(event.target.value as ReportRange)}>
            <option value="7 days">Last 7 days</option><option value="30 days">Last 30 days</option><option value="90 days">Last 90 days</option>
          </select>
        </label>
        <button type="button" className="secondary inline-flex items-center gap-2" disabled={!report} onClick={() => { if (report) downloadCsv(range, report); }}><Download size={14} />Export CSV</button>
      </div>
    </header>

    {!report && !error && <p role="status" className="admin-panel p-8 text-sm text-slate-500">Loading report…</p>}
    {error && <p role="alert" className="notice">Report unavailable: {error} <button type="button" className="ml-2 underline" onClick={() => { setFailure(null); setResult(null); setRefresh(value => value + 1); }}>Retry report</button></p>}
    {report && <>
    <div role="note" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <span><strong>RECORDED DATA</strong> — Service bookings created in this period; statuses reflect the latest stored state.</span>
      <span>{report.period}</span>
    </div>

    {report.bookings === 0 && <p role="status" className="admin-panel p-5 text-sm text-slate-500">No service bookings were created in this period.</p>}
    <section aria-label="Report summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Bookings" value={report.bookings.toLocaleString()} detail={`During ${range}`} icon={CalendarDays} />
      <MetricCard label="Completed" value={report.completed.toLocaleString()} detail={report.bookings ? `${completionRate}% completion rate` : 'No bookings in this period'} icon={CheckCircle2} />
      <MetricCard label="Active providers" value={report.activeProviders.toLocaleString()} detail="Published listings across all four provider roles, including Home Garage; independent of date range" icon={Users} />
      <MetricCard label="Average rating" value={report.averageRating === null ? 'No reviews' : `${formatReportRating(report.averageRating)} / 5`} detail={`${report.reviewCount} valid customer reviews submitted in this period`} icon={Star} />
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
      <section className="admin-panel min-w-0">
        <div className="admin-section-heading"><div><h3>Booking activity</h3><p>Bookings created across the selected period</p></div></div>
        <div className="px-5 pb-5">
          <div className="mb-4 flex items-end justify-between"><strong className="text-3xl font-semibold tabular-nums">{report.bookings.toLocaleString()}</strong><span className="text-xs text-slate-400">total bookings</span></div>
          <div role="img" aria-label={`Booking activity: ${chartAria}.`} className="flex h-52 items-end gap-2 border-b border-slate-200 px-1 sm:gap-4">
            {report.trend.map((value, index) => <div key={report.intervals[index]} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-5">
              <span className="text-[9px] font-medium text-slate-500">{value}</span>
              <div title={`${report.intervals[index]}: ${value} bookings`} className={`w-full max-w-12 rounded-t-sm ${index === report.trend.length - 1 ? 'bg-brand' : 'bg-red-200'}`} style={{ height: `${value / maxTrend * 70}%` }} />
              <span className="absolute bottom-1 whitespace-nowrap text-[9px] text-slate-400">{report.labels[index]}</span>
            </div>)}
          </div>
          <p className="mt-4 text-[10px] text-slate-400">Intervals use Philippine calendar days. Today includes records up to the report load time.</p>
        </div>
      </section>

      <section className="admin-panel min-w-0">
        <div className="admin-section-heading"><div><h3>Bookings by provider</h3><p>Recorded service category distribution</p></div></div>
        <div className="space-y-5 px-5 pb-5">
          {report.categories.map(item => {
            const percent = (totalByCategory ? Math.round(item.value / totalByCategory * 100) : 0);
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
      <div className="admin-section-heading"><div><h3>Report notes</h3><p>Scope and interpretation</p></div></div>
      <div className="grid gap-4 px-5 pb-5 text-xs leading-5 text-slate-600 md:grid-cols-3">
        <p className="rounded border border-slate-100 p-4">{report.bookings ? `Completion is ${completionRate}% among bookings created in this period, using their current stored status.` : 'Completion rate is unavailable because no bookings were created in this period.'}</p>
        <p className="rounded border border-slate-100 p-4">{largest && largest.value > 0 ? `${largest.label} is a largest booking category with ${largest.value.toLocaleString()} bookings.` : 'No service bookings recorded in this period.'}</p>
        <p className="rounded border border-slate-100 p-4">Bookings include mechanics, shops, towing, and home garage service requests. Parking sessions are excluded from booking totals by current Admin permissions. Ratings cover reviews submitted in this period, including reviews of older bookings and parking sessions. Active providers are listings with visibility set to active.</p>
      </div>
    </section>
    </>}
  </div>;
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof CalendarDays }) {
  return <article className="admin-panel p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p></div><span className="rounded-md bg-slate-50 p-2 text-brand"><Icon size={18} /></span></div>
    <p className="mt-3 text-[10px] text-slate-400">{detail}</p>
  </article>;
}
