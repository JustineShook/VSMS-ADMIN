import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { bookingError, loadBookingsPage, type BookingStatus, type RecentBooking } from '../services/bookings';
import { Avatar } from '../components/admin/Avatar';
import { StatusBadge } from '../components/admin/StatusBadge';
import { BookingDetails } from '../components/admin/BookingDetails';

const statusOptions: { value: BookingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' }, { value: 'pending', label: 'Pending' }, { value: 'accepted', label: 'Accepted' },
  { value: 'vehicle_arrived', label: 'Vehicle arrived' }, { value: 'diagnosing', label: 'Diagnosing' }, { value: 'repairing', label: 'Repairing' },
  { value: 'en_route', label: 'En route' }, { value: 'arrived', label: 'Arrived' }, { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' }, { value: 'rejected', label: 'Rejected' }, { value: 'cancelled', label: 'Cancelled' },
];
const categoryOptions = [
  { value: 'all', label: 'All categories' },
  { value: 'onsite-mechanic', label: 'Onsite Mechanics' },
  { value: 'shop-owner', label: 'Auto Shops' },
  { value: 'towing-company', label: 'Towing' },
] as const;
function dateLabel(date: Date | null): string { return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'; }

export function BookingsPage() {
  const [rows, setRows] = useState<RecentBooking[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [category, setCategory] = useState<(typeof categoryOptions)[number]['value']>('all');
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<RecentBooking | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const page = await loadBookingsPage();
      setRows(page.bookings);
      setCursor(page.cursor);
      setHasMore(page.cursor !== null);
    } catch (err) { setError(bookingError(err)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await loadBookingsPage(cursor);
      setRows(current => [...current, ...page.bookings]);
      setCursor(page.cursor);
      setHasMore(page.cursor !== null);
    } catch (err) { setError(bookingError(err)); }
    finally { setLoadingMore(false); }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rows.filter(row => (status === 'all' || row.status === status)
      && (category === 'all' || row.category === category)
      && (!term || [row.id, row.customer, row.provider, row.service].some(value => value.toLocaleLowerCase().includes(term))));
  }, [rows, search, status, category]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">SERVICE OPERATIONS</p><h2 className="text-2xl font-semibold tracking-tight">All Bookings</h2><p className="mt-2 text-xs text-slate-500">Browse every service request, newest first.</p></div><span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">LIVE FIRESTORE</span></div>
    <section className="admin-panel min-w-0">
      <div className="admin-section-heading"><div><h3>Booking records</h3><p>{busy ? 'Loading bookings…' : `${visible.length} shown · ${rows.length} loaded`}</p></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-400"><Search size={14} /><input className="w-36 bg-transparent text-xs text-slate-700 outline-none" placeholder="Search loaded bookings" aria-label="Search loaded bookings" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="sr-only" htmlFor="booking-status-filter">Filter bookings by status</label><select id="booking-status-filter" className="field w-auto py-2 text-xs" value={status} onChange={event => setStatus(event.target.value as BookingStatus | 'all')}>{statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><label className="sr-only" htmlFor="booking-category-filter">Filter bookings by provider category</label><select id="booking-category-filter" className="field w-auto py-2 text-xs" value={category} onChange={event => setCategory(event.target.value as typeof category)}>{categoryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="admin-icon" onClick={() => void refresh()} disabled={busy || loadingMore} aria-label="Refresh all bookings"><RefreshCw size={17} className={busy ? 'animate-spin' : ''} /></button></div></div>
      {error && <p role="alert" className="notice mx-5 mb-4">{error}</p>}
      {busy && <p role="status" className="px-5 pb-5 text-sm text-slate-500">Loading bookings from Firestore…</p>}
      {!busy && !error && visible.length === 0 && <p className="px-5 pb-5 text-sm text-slate-500">{rows.length ? 'No loaded bookings match these filters. Load more to search older records.' : 'No bookings have been recorded yet.'}</p>}
      {!busy && visible.length > 0 && <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="All booking records"><table className="admin-table min-w-[900px]"><thead><tr>{['Booking ID', 'Customer', 'Provider', 'Service', 'Status', 'Created'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id}><td><button className="font-mono text-[10px] text-brand underline" onClick={() => setSelectedBooking(row)} aria-label={`View details for booking ${row.id}`}>#{row.id}</button></td><td><span className="flex items-center gap-2"><Avatar name={row.customer} /><span className="font-medium text-slate-700">{row.customer}</span></span></td><td>{row.provider}</td><td>{row.service}</td><td><StatusBadge status={row.status} /></td><td>{dateLabel(row.createdAt)}</td></tr>)}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3"><p className="text-[10px] text-slate-400">Search and status filter apply to loaded records. Load older bookings to include them.</p>{hasMore && <button className="secondary" disabled={busy || loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more bookings'}</button>}</div>
    </section>
    {selectedBooking && <BookingDetails key={selectedBooking.id} booking={selectedBooking} onClose={() => setSelectedBooking(null)} />}
  </div>;
}
