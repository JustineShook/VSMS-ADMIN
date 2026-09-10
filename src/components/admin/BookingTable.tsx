import { ArrowUpRight } from 'lucide-react';
import { bookings } from '../../data/dashboardMock';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
export function BookingTable() {
  return <section className="admin-panel min-w-0">
    <div className="admin-section-heading"><div><h2>Recent bookings</h2><p>A snapshot of the latest service requests</p></div><button className="admin-preview-link" disabled>View all bookings <ArrowUpRight size={14} /></button></div>
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Recent sample bookings, scroll horizontally on smaller screens">
      <table className="admin-table min-w-[850px]"><caption className="sr-only">Recent bookings — fictional sample data</caption><thead><tr>{['Booking ID', 'Customer', 'Provider', 'Service', 'Status', 'Date'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{bookings.map(booking => <tr key={booking.id}>
          <td><span className="font-medium text-brand">#{booking.id}</span></td>
          <td><span className="flex items-center gap-2.5"><Avatar name={booking.customer} /><span className="font-medium text-slate-700">{booking.customer}</span></span></td>
          <td>{booking.provider}</td><td>{booking.service}</td><td><StatusBadge status={booking.status} /></td>
          <td><span className="block">Sep 10, 2026</span><span className="mt-1 block text-[10px] text-slate-400">{booking.time}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400"><span>Showing 7 sample bookings</span><span>All names and activity are illustrative</span></div>
  </section>;
}
