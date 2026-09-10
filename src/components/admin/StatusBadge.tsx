import type { BookingStatus } from '../../data/dashboardMock';
const colors: Record<BookingStatus, string> = {
  Pending: 'bg-amber-50 text-amber-800', Accepted: 'bg-slate-100 text-slate-700',
  'Vehicle Arrived': 'bg-slate-100 text-slate-700', Diagnosing: 'bg-slate-100 text-slate-700',
  Repairing: 'bg-red-50 text-brand', Completed: 'bg-emerald-50 text-emerald-800', Rejected: 'bg-red-50 text-red-800',
};
export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium ${colors[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}
