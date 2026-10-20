import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { loadApplications, verificationError, type Cursors } from '../../services/verification';
import { roleLabels } from '../../lib/verification';
import type { Application } from '../../types/verification';
import { VerificationDetails } from './VerificationDetails';
import { Avatar } from './Avatar';

export function VerificationTable() {
  const [rows, setRows] = useState<Application[]>([]);
  const [cursors, setCursors] = useState<Cursors>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Application | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | Application['role']>('all');
  const generation = useRef(0);

  const load = useCallback(async (after?: Cursors) => {
    const current = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const result = await loadApplications(after);
      if (current !== generation.current) return;
      setRows(previous => after
        ? [...new Map([...previous, ...result.applications].map(row => [row.path, row])).values()]
        : result.applications);
      setCursors(result.cursors);
    } catch (err) {
      if (current === generation.current) setError(verificationError(err));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { ++generation.current; };
  }, [load]);

  const hasMore = Object.values(cursors).some(cursor => cursor != null);
  const pendingCount = rows.filter(row => !row.legacy).length;
  const legacyCount = rows.length - pendingCount;
  const visibleRows = rows.filter(row => roleFilter === 'all' || row.role === roleFilter);

  return <section id="user-verification" className="admin-panel min-w-0 scroll-mt-6">
    <div className="admin-section-heading">
      <div>
        <h2>User verification <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-brand">LIVE FIRESTORE</span></h2>
        <p>{pendingCount} pending applications loaded{legacyCount ? ` · ${legacyCount} unverified legacy shops` : ''}{hasMore ? ' · More records available' : ''}</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="verification-role-filter">Filter users by account type</label>
        <select id="verification-role-filter" className="field w-auto py-2 text-xs" value={roleFilter} onChange={event => setRoleFilter(event.target.value as typeof roleFilter)}>
          <option value="all">All account types</option>
          <option value="owner">Vehicle Owners</option>
          <option value="onsite-mechanic">Onsite Mechanics</option>
          <option value="shop-owner">Auto Shops</option>
          <option value="towing-company">Towing Companies</option>
          <option value="homegarage">Home Garage</option>
        </select>
        <button className="admin-icon" onClick={() => void load()} disabled={busy} aria-label="Refresh verification applications"><RefreshCw size={17} className={busy ? 'animate-spin' : ''} /></button>
      </div>
    </div>
    {message && <p role="status" className="mx-5 mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="notice mx-5 mb-4">{error}</p>}
    {busy && <p role="status" className="px-5 pb-4 text-sm text-slate-500">Loading applications…</p>}
    {!busy && !error && rows.length === 0 && <p className="px-5 pb-5 text-sm text-slate-500">{hasMore ? 'No applications on these pages. Load more to continue checking.' : 'No pending user applications or unverified legacy shops.'}</p>}
    {!busy && !error && rows.length > 0 && visibleRows.length === 0 && <p className="px-5 pb-5 text-sm text-slate-500">No verification applications match this account type.</p>}
    {visibleRows.length > 0 && <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="User verification applications">
      <table className="admin-table min-w-[640px]">
        <thead><tr>{['User', 'Account type', 'Submitted', 'Status', 'Action'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
        <tbody>{visibleRows.map(provider => <tr key={provider.path}>
          <td><span className="flex items-center gap-2"><Avatar name={provider.name} /><span className="font-medium text-slate-700">{provider.name}</span></span></td>
          <td>{roleLabels[provider.role]}</td>
          <td>{provider.submitted}</td>
          <td>{provider.legacy ? 'Unverified · legacy' : 'PENDING'}</td>
          <td><button disabled={busy || !!error} className="rounded border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-brand" onClick={() => { setSelected(provider); setMessage(''); }}>View / Review</button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
      <p className="text-[10px] text-slate-400">Live Firestore records · Refresh to retrieve the latest submissions</p>
      {hasMore && <button className="secondary" disabled={busy} onClick={() => void load(cursors)}>Load more</button>}
    </div>
    {selected && <VerificationDetails key={selected.path} application={selected} onClose={() => setSelected(null)} onSaved={notice => {
      setRows(previous => previous.filter(row => row.path !== selected.path));
      setSelected(null);
      setMessage(notice);
      void load();
    }} />}
  </section>;
}
