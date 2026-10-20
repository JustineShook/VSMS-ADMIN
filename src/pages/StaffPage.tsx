import { useCallback, useEffect, useState } from 'react';
import { Check, Clipboard, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Avatar } from '../components/admin/Avatar';
import { loadStaffRequests, reviewStaffRequest, staffDateLabel, type StaffRequest } from '../services/staff';

export function StaffPage() {
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [busy, setBusy] = useState(true);
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setRequests(await loadStaffRequests()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load staff access requests.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function copyUid(uid: string) {
    try { await navigator.clipboard.writeText(uid); setCopiedId(uid); window.setTimeout(() => setCopiedId(''), 1800); }
    catch { setError('Could not copy the UID. Select and copy it manually.'); }
  }

  async function review(row: StaffRequest, decision: 'APPROVED' | 'REJECTED') {
    const verb = decision === 'APPROVED' ? 'record that you granted admin access to' : 'reject';
    if (!window.confirm(`Are you sure you want to ${verb} ${row.email || row.uid}?${decision === 'APPROVED' ? '\n\nOnly continue after you have assigned the admin claim with trusted Admin SDK tooling.' : ''}`)) return;
    setActiveId(row.id); setError(''); setMessage('');
    try {
      await reviewStaffRequest(row.id, decision);
      setMessage(decision === 'APPROVED' ? `Manual claim grant recorded for ${row.email || row.uid}.` : `Staff request from ${row.email || row.uid} was rejected.`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not review this staff request.'); }
    finally { setActiveId(''); }
  }

  const pending = requests.filter(row => row.status === 'PENDING');
  const reviewed = requests.filter(row => row.status !== 'PENDING');

  return <div className="space-y-6">
    <section className="admin-card overflow-hidden">
      <div className="admin-section-heading"><div><h2>Staff access requests</h2><p>Review people who requested access to verify user submissions.</p></div><button className="admin-icon" type="button" onClick={() => void refresh()} disabled={busy} aria-label="Refresh staff requests"><RefreshCw size={17} className={busy ? 'animate-spin' : ''} /></button></div>
      <div className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Manual claim required on Spark.</strong> Before marking a request approved here, verify the person and assign the Firebase <code>admin: true</code> custom claim using trusted Admin SDK tooling. This page cannot set the claim.</div>
      {message && <p role="status" className="mx-5 mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="notice mx-5 mb-4">{error}</p>}
      {busy && requests.length === 0 && <p role="status" className="px-5 pb-5 text-sm text-slate-500">Loading staff requests…</p>}
      {!busy && !error && pending.length === 0 && <div className="px-5 py-10 text-center"><ShieldCheck className="mx-auto text-slate-300" size={30} /><p className="mt-3 text-sm font-medium text-slate-700">No pending staff requests</p><p className="mt-1 text-xs text-slate-500">New requests appear here after staff submit them from the access page.</p></div>}
      {pending.length > 0 && <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Pending staff access requests"><table className="admin-table min-w-[850px]"><thead><tr>{['Applicant', 'Firebase UID', 'Requested', 'Review'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{pending.map(row => <tr key={row.id}><td><span className="flex items-center gap-2"><Avatar name={row.displayName || row.email || row.uid} /><span><span className="block font-medium text-slate-700">{row.displayName || 'Name not provided'}</span><span className="text-xs text-slate-500">{row.email || 'Email unavailable'}</span></span></span></td><td className="font-mono text-[10px] text-slate-500">{row.uid}<button className="ml-2 inline-flex text-brand" type="button" onClick={() => void copyUid(row.uid)} aria-label="Copy applicant UID" title="Copy UID"><Clipboard size={13} /></button>{copiedId === row.uid && <span className="ml-1 font-sans text-emerald-700">Copied</span>}</td><td>{staffDateLabel(row.requestedAt)}</td><td><span className="flex gap-2"><button className="primary px-3 py-2" type="button" disabled={!!activeId} onClick={() => void review(row, 'APPROVED')}><Check size={15} />Record grant</button><button className="secondary px-3 py-2" type="button" disabled={!!activeId} onClick={() => void review(row, 'REJECTED')}><X size={15} />Reject</button></span>{activeId === row.id && <span className="mt-1 block text-[11px] text-slate-500">Saving…</span>}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="admin-card overflow-hidden">
      <div className="admin-section-heading"><div><h2>Reviewed requests</h2><p>{reviewed.length} recent decisions</p></div></div>
      {reviewed.length === 0 ? <p className="px-5 pb-5 text-sm text-slate-500">No reviewed staff requests yet.</p> : <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Reviewed staff requests"><table className="admin-table min-w-[680px]"><thead><tr>{['Staff account', 'Status', 'Reviewed'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{reviewed.map(row => <tr key={row.id}><td><span className="block font-medium text-slate-700">{row.displayName || 'Name not provided'}</span><span className="text-xs text-slate-500">{row.email || row.uid}</span></td><td><span className={row.status === 'MANUAL_GRANT_RECORDED' ? 'font-medium text-emerald-700' : 'font-medium text-slate-500'}>{row.status === 'MANUAL_GRANT_RECORDED' ? 'Manual grant recorded' : 'Rejected'}</span></td><td>{staffDateLabel(row.reviewedAt)}</td></tr>)}</tbody></table></div>}
      <p className="border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-500">Approved staff receive the existing full admin claim and therefore have all current admin dashboard permissions. A manual grant record here is an audit note; it does not verify the claim itself.</p>
    </section>
  </div>;
}
