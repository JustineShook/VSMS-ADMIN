import type { BookingStatus } from '../../services/bookings';
const colors: Record<BookingStatus, string> = {
  pending: 'bg-amber-50 text-amber-800', accepted: 'bg-slate-100 text-slate-700',
  vehicle_arrived: 'bg-slate-100 text-slate-700', diagnosing: 'bg-slate-100 text-slate-700',
  repairing: 'bg-red-50 text-brand', en_route: 'bg-slate-100 text-slate-700', arrived: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-red-50 text-brand', completed: 'bg-emerald-50 text-emerald-800', rejected: 'bg-red-50 text-red-800',
  cancelled: 'bg-slate-100 text-slate-500', unknown: 'bg-slate-100 text-slate-700',
};
const labels: Record<BookingStatus, string> = {
  pending: 'Pending', accepted: 'Accepted', vehicle_arrived: 'Vehicle Arrived', diagnosing: 'Diagnosing', repairing: 'Repairing',
  en_route: 'En Route', arrived: 'Arrived', in_progress: 'In Progress', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled', unknown: 'Unknown',
};
export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium ${colors[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{labels[status]}</span>;
}
