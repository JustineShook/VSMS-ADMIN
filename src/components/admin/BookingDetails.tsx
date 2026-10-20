import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { bookingError, loadBookingDetails, type RecentBooking } from '../../services/bookings';
import { StatusBadge } from './StatusBadge';

function labelFor(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^\w/, value => value.toUpperCase());
}
function formatValue(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return (value.toDate() as Date).toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ') || 'None';
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : 'Not provided';
}

export function BookingDetails({ booking, onClose }: { booking: RecentBooking; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    void loadBookingDetails(booking.id).then(value => { if (active) setData(value); }, reason => { if (active) setError(bookingError(reason)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [booking.id]);

  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="booking-detail-title" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[760px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/40">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5"><div><h2 id="booking-detail-title" className="text-lg font-semibold">Booking #{booking.id}</h2><p className="mt-1 flex items-center gap-2 text-xs text-slate-500">{booking.service}<StatusBadge status={booking.status} /></p></div><button className="admin-icon" onClick={onClose} aria-label="Close booking details"><X size={20} /></button></div>
    <div className="space-y-4 p-5">
      <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Booking details can include customer contact, vehicle, and pickup information. Keep this view within authorized administration.</p>
      {busy && <p role="status" className="text-sm text-slate-500">Loading booking details…</p>}
      {error && <p role="alert" className="notice">{error}</p>}
      {data && <dl className="grid gap-4 sm:grid-cols-2">{Object.entries(data).map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-slate-500">{labelFor(key)}</dt><dd className="mt-1 break-words text-sm">{formatValue(value)}</dd></div>)}</dl>}
    </div>
  </dialog>;
}
