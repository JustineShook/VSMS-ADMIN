import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { bookingError, loadRecentBookings, type RecentBooking } from '../../services/bookings';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';

function dateLabel(date: Date | null): string {
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
}

export function BookingTable() {
  const [rows, setRows] = useState<RecentBooking[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setRows(await loadRecentBookings()); }
    catch (err) { setError(bookingError(err)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <section id="recent-bookings" className="admin-panel min-w-0 scroll-mt-6">
    <div className="admin-section-heading"><div><h2>Recent bookings <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-brand">LIVE FIRESTORE</span></h2><p>Latest service requests across all providers</p></div><button className="admin-icon" onClick={() => void load()} disabled={busy} aria-label="Refresh recent bookings"><RefreshCw size={17} className={busy ? 'animate-spin' : ''} /></button></div>
    {error && <p role="alert" className="notice mx-5 mb-4">{error}</p>}
    {busy && <p role="status" className="px-5 pb-4 text-sm text-slate-500">Loading recent bookings…</p>}
    {!busy && !error && rows.length === 0 && <p className="px-5 pb-5 text-sm text-slate-500">No bookings have been recorded yet.</p>}
    {rows.length > 0 && <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Recent bookings">
      <table className="admin-table min-w-[850px]"><caption className="sr-only">Latest live bookings</caption><thead><tr>{['Booking ID', 'Customer', 'Provider', 'Service', 'Status', 'Date'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
        <tbody>{rows.map(booking => <tr key={booking.id}>
          <td><span className="font-medium text-brand">#{booking.id}</span></td>
          <td><span className="flex items-center gap-2.5"><Avatar name={booking.customer} /><span className="font-medium text-slate-700">{booking.customer}</span></span></td>
          <td>{booking.provider}</td><td>{booking.service}</td><td><StatusBadge status={booking.status} /></td><td>{dateLabel(booking.createdAt)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400"><span>{rows.length} latest live bookings</span><span>Refresh to retrieve current records</span></div>
  </section>;
}
